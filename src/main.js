import * as fsPromises from "node:fs/promises";
import OpenAI from "openai";

class Reteller {
  constructor({
      llm,
      prompt = 'Составь полный пересказ следующего текста без разбивки на ключевые события и без подведения итогов, не разделяй ответ на пункты',
      chapterSeparator = /\n((?:\d+\.)|(?:\[\d+\.])|(?:Интерлюдия ?\d{0,2}\.) [а-яА-ЯёЁ 0-9,]+)/,
      postfix = '(краткое содержание)',
    }) {
    this.llm = llm;
    this.prompt = prompt;
    this.chapterSeparator = chapterSeparator;
    this.postfix = postfix;
  }

  /**
   * @param {String} inputDirectory Path to directory
   * @param {String} [outputDirectory] Optional path to output directory
   * @returns {Promise<void>}
   */
  async processDirectory(inputDirectory = './books', outputDirectory = `${inputDirectory}_annotation`) {
    const directoryContent = await fsPromises.readdir(inputDirectory, { withFileTypes: true })
    const files = directoryContent.filter(file => file.isFile())
    const fileNames = files.map(file => file.name)

    await fsPromises.mkdir(outputDirectory, { recursive: true })

    for (const fileName of fileNames) {
      await this.processFile(inputDirectory + '/' + fileName, this.makeOutputFileName(fileName, outputDirectory));
    }
  }

  /**
   * @param {String} inputFileName Path to file
   * @param {String} [outputFileName] Optional path to output file
   * @returns {Promise<void>}
   */
  async processFile(inputFileName, outputFileName = this.makeOutputFileName(inputFileName)) {
    console.info(`Начата обработка файла "${inputFileName}"`);
    console.time('Файл обработан, общее время')
    const [data, alreadyAnnotatedChaptersAmount] = await Promise.all([
      fsPromises.readFile(inputFileName, 'utf8'),
      this.processAlreadyAnnotatedChapters(outputFileName),
    ]);

    const text = this.extractText(data);
    const chapters = this.splitTextIntoChapters(text);

    this.analyze(chapters)

    const outputFile = await fsPromises.open(outputFileName, 'a');
    for (let i = alreadyAnnotatedChaptersAmount; i < chapters.length; i++) {
      console.info(`Начато аннотирование ${i + 1} главы из ${chapters.length}`);
      await this.processChapter(chapters[i], outputFile);
    }
    await outputFile.close();
    console.timeEnd('Файл обработан, общее время')
  }

  /**
   * @param {String} data RAW text with empty lines, multiple space, fb2 tags
   * @returns {String} Formatted text without empty lines, fb2 tags
   */
  extractText(data) {
    const body = data.match(/<body>.*<\/body>/s); // try to find fb2 structure
    const text = body ? body[0].replace(/<(?!\/?title>)[^>]*?>/g, '') : data; // remove tags if fb2 except title tag

    let trimmedText = text.replace(/ {2,}/g, ' ') // remove double spaces
    trimmedText = trimmedText.replace(/(\r?\n ?)+/g, '\n'); // remove empty lines
    trimmedText = trimmedText.replace(/<title>\n?(.+?)\n?<\/title>/g, '<title>$1</title>'); // remove \n from title tag
    trimmedText = trimmedText.startsWith('\n') ? trimmedText.slice(1) : trimmedText; // remove empty lines in the beginning

    return trimmedText;
  }

  /**
   * @param {String} text Formatted text
   * @returns {String[]} Array of chapters
   */
  splitTextIntoChapters(text) {
    const chaptersAndTitles = text.includes('<title>')
        ? text.split(/<title>(.+?)<\/title>/)
        : text.split(this.chapterSeparator);

    const chapters = chaptersAndTitles[0] ? [chaptersAndTitles[0]] : []; // first part is title of whole text, not chapter
    for (let i = 1; i < chaptersAndTitles.length; i += 2) {
      const title = chaptersAndTitles[i]
      const content = chaptersAndTitles[i + 1];

      if (content?.length > 100) { // ignore small parts of text. it isn't chapter, just parse failure
        chapters.push(title + content);
      }
    }
    return chapters;
  }

  /**
   * Remove not finished chapters retail and returns amount of already retailed chapters
   * @param {String} outputFileName Path to file
   * @returns {Promise<Number>} Amount of already annotated chapters
   */
  async processAlreadyAnnotatedChapters(outputFileName) {
    let chaptersAmount = 0;

    try {
      const alreadyAnnotatedText = await fsPromises.readFile(outputFileName, 'utf8');
      const chapters = alreadyAnnotatedText.match(/.+\n\n(.+\n)+\n\n/g) // pattern of retailed chapter (title, empty line, content, two empty lines)
      await fsPromises.writeFile(outputFileName, chapters.join('')) // remove not finished parts (witch don't match pattern)
      chaptersAmount = chapters.length
    } catch {}

    return chaptersAmount
  }

  /**
   * @param {String} chapter Formatted chapter with title and content
   * @param {fsPromises.FileHandle} outputFile File handle to write output
   * @returns {Promise<void>}
   */
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

  /**
   * @param {String} chapter Formatted chapter with title and content
   * @returns {Promise<{title: String, annotationStream: AsyncIterableIterator<OpenAI.ChatCompletionChunk>}>}
   */
  async annotateChapter(chapter) {
    const title = chapter.slice(0, chapter.indexOf('\n'));
    const content = chapter.slice(chapter.indexOf('\n') + 1);

    const annotationStream = await this.llm.chat.completions.create({
      messages: [{
        role: 'user',
        content: `${this.prompt}: ${content}`
      }],
      stream: true,
    });

    return { title, annotationStream };
  }

  /**
   * @param {String[]} chapters Array of chapters
   * @returns {void}
   */
  analyze(chapters) {
    const itemCount = chapters.map(chapter => {
      const content = chapter.slice(chapter.indexOf('\n') + 1);
      return content.split(/([\s,.!?…—])/).length;
    })

    console.info({
      minItems: Math.min(...itemCount),
      averageItems: Math.ceil(itemCount.reduce((a, b) => a + b, 0) / itemCount.length),
      maxItems: Math.max(...itemCount),
      predictionTokenAmount: Math.ceil(Math.max(...itemCount) * 0.12 * 0.12), // maxItem * 0.12 (response tokens) * 0.12 (fault)
    })
  }

  /**
   * @param {String} fileName File name
   * @param {String} [dir] Optional path to directory
   * @returns {String} Path to output file with postfix
   */
  makeOutputFileName(fileName, dir = '.') {
    const name = fileName.slice(0, fileName.lastIndexOf('.'));
    return `${dir}/${name} ${this.postfix}.txt`;
  }
}


const llm = new OpenAI({
  baseURL: 'http://127.0.0.1:1234/v1/',
  apiKey: 'not-needed',
  timeout: 1201000,
});

const reteller = new Reteller({ llm });
 reteller.processFile('книга.txt');
//reteller.processDirectory();
