import * as fsPromises from "node:fs/promises"
import OpenAI from "openai";


const llm = new OpenAI({
  baseURL: 'http://192.168.2.65:1234/v1/',
  apiKey: 'not-needed',
});

class Reteller {
  async processFile(inputFileName, outputFileName) {
    console.time('Общее время')
    const data = await fsPromises.readFile(inputFileName, 'utf8');

    const text = this.extractText(data);
    const chapters = this.splitTextIntoChapters(text);

    const outputFile = await fsPromises.open(outputFileName, 'w');
    for (let i = 0; i < chapters.length; i++) {
      console.time(`Аннотирование главы ${i + 1} из ${chapters.length}`);
      const { title, annotation } = await this.annotateChapter(chapters[i]);
      await fsPromises.appendFile(outputFile, `${title}\n\n${annotation}\n\n\n}`);
      console.timeEnd(`Аннотирование главы ${i + 1} из ${chapters.length}`);
    }
    await outputFile.close();
    console.timeEnd('Общее время')
  }

  extractText(data) {
    return data.replace(/(\r?\n ?)+/g, '\n');
    // TODO: Add extraction text from fb2
  }

  splitTextIntoChapters(text) {
    const chaptersAndTitles = text.split(/\n(\d+\.\s[а-яА-ЯёЁ 0-9,]+)/);

    const chapters = [chaptersAndTitles[0]];
    for (let i = 1; i < chaptersAndTitles.length; i += 2) {
      const title = chaptersAndTitles[i]
      const content = chaptersAndTitles[i + 1];
      chapters.push(title + content);
    }
    return chapters;
  }

  async annotateChapter(chapter) {
    const prompt = 'Составь полный пересказ следующего текста'
    const title = chapter.slice(0, chapter.indexOf('\n'));
    const context = chapter.slice(chapter.indexOf('\n') + 1);

    const response = await llm.chat.completions.create({
      messages: [{
        role: 'user',
        content: `${prompt}: ${context}`
      }],
    });

    return { title, annotation: response.choices[0].message.content };
  }
}

const reteller = new Reteller();
reteller.processFile('книга.txt', 'Краткое содержание.txt');
