import * as fsPromises from "node:fs/promises"
import OpenAI from "openai";

class Reteller {
  constructor({
      llm,
      prompt = 'Составь полный пересказ следующего текста без разбивки на ключевые события и без подведения итогов, не разделяй ответ на пункты',
      chapterSeparator = /\n(\d+\.\s[а-яА-ЯёЁ 0-9,]+)/,
    }) {
    this.llm = llm;
    this.prompt = prompt;
    this.chapterSeparator = chapterSeparator;
  }

  async processFile(inputFileName, outputFileName) {
    console.time('Общее время')
    const data = await fsPromises.readFile(inputFileName, 'utf8');

    const text = this.extractText(data);
    const chapters = this.splitTextIntoChapters(text);

    const outputFile = await fsPromises.open(outputFileName, 'w');
    for (let i = 0; i < chapters.length; i++) {
      console.info(`Начато аннотирование ${i + 1} главы из ${chapters.length}`);
      await this.processChapter(chapters[i], outputFile);
    }
    await outputFile.close();
    console.timeEnd('Общее время')
  }

  extractText(data) {
    const body = data.match(/<body>.*<\/body>/s); // try to find fb2 structure
    const text = body ? body[0].replace(/<[^>]*?>/g, '') : data; // remove tags if fb2

    let trimmedText = text.replace(/ {2,}/g, ' ') // remove double spaces
    trimmedText = trimmedText.replace(/(\r?\n ?)+/g, '\n'); // remove empty lines
    trimmedText = trimmedText.startsWith('\n') ? trimmedText.slice(1) : trimmedText;

    return trimmedText.slice(trimmedText.indexOf('\n') + 1); // remove main title
  }

  splitTextIntoChapters(text) {
    const chaptersAndTitles = text.split(this.chapterSeparator);

    const chapters = [chaptersAndTitles[0]];
    for (let i = 1; i < chaptersAndTitles.length; i += 2) {
      const title = chaptersAndTitles[i]
      const content = chaptersAndTitles[i + 1];
      chapters.push(title + content);
    }
    return chapters;
  }

  async processChapter(chapter, outputFile) {
    console.time(`Глава обработана`)
    const { title, annotationStream } = await this.annotateChapter(chapter);

    await fsPromises.appendFile(outputFile, `${title}\n\n`);

    for await (const chunk of annotationStream) {
      const annotateChunk = chunk.choices[0]?.delta?.content ?? ''
      await fsPromises.appendFile(outputFile, annotateChunk.replaceAll(/\n\n/g, '\n'));
    }

    await fsPromises.appendFile(outputFile, `\n\n\n`);
    console.timeEnd(`Глава обработана`);
  }

  async annotateChapter(chapter) {
    const title = chapter.slice(0, chapter.indexOf('\n'));
    const context = chapter.slice(chapter.indexOf('\n') + 1);

    const annotationStream = await this.llm.chat.completions.create({
      messages: [{
        role: 'user',
        content: `${this.prompt}: ${context}`
      }],
      stream: true,
    });

    return { title, annotationStream };
  }
}


const llm = new OpenAI({
  baseURL: 'http://192.168.2.65:1234/v1/',
  apiKey: 'not-needed',
  timeout: 1201000,
});

const reteller = new Reteller({ llm });
reteller.processFile('книга.txt', 'Краткое содержание.txt');
