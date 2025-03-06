# Reteller
Retell text, using AI. Supports ```.txt``` and ```.fb2``` files. It reduces text in ~10 times.

This program separate text to chapters and retell all of them. You can use local LLM or API-based LLM.

## Use

You need to install [Node.js](https://nodejs.org/) to run this program.<br>
After installing, execute ```npm i``` to install dependencies.<br>
After that, you can run program ```npm start %path_to_your_file_or_dirrectory%```.

### Args

All of this args (exclude input) aren't required.<br>
You can set input path without ```--input``` arg (commands ```npm start ./text.txt``` and ```npm start --input=./text.txt``` are equal)

| Key                 | Description                                                                                                                                              | Default                                                                                                                         |
|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| --input             | Path to file or directory                                                                                                                                | -                                                                                                                               |
| --output            | Path to file or directory                                                                                                                                | Input path with postfix                                                                                                         |
| --postfix           | Processed filename postfix. <br> e.g. For ```./input.txt``` will created```./input (краткое содержание).txt```                                           | (краткое содержание)                                                                                                            | 
| --chapter_separator | Regexp without flags to find and separate chapters in txt files (fb2 don't need this).<br>Format: ```--chapter_separator='/\n(chapter_title_regexp)/'``` | '/\n((?:Глава \d+\.?[а-яА-ЯёЁ 0-9,]*)\|(?:\*\*\*))/'                                                                            |
| --stats             | Show statistics (min/max/average words in chapters and predict LLM's tokens amount)                                                                      | false                                                                                                                           |
| --url               | URL to LLM                                                                                                                                               | http://127.0.0.1:1234/v1/                                                                                                       |
| --api_key           | Token for LLM                                                                                                                                            | not-needed                                                                                                                      |
| --timeout           | LLM's response timeout (ms)                                                                                                                              | 20 * 60 * 1000                                                                                                                  |
| --prompt            | Request to LLM.<br>Structure ```%promt% : %text_of_chapter%```                                                                                           | Составь полный пересказ следующего текста без разбивки на ключевые события и без подведения итогов, не разделяй ответ на пункты |

## Use local LLM

It is so simple to use local LLM:
1. Download LM Studio https://lmstudio.ai/
2. Select developer mode https://lmstudio.ai/docs/app/user-interface/modes
3. Download LMM https://lmstudio.ai/docs/app/basics/download-model
4. Load model (Ctrl+L)
5. Start server https://lmstudio.ai/docs/app/api

### LLM choosing

I use [T-lite 1.0 LLM](https://huggingface.co/t-tech/T-lite-it-1.0). It is so good for russian language.

If you have 8GB VRAM use LLM 8B parameters with Q8_0 quantation. This is enough for your tasks.

- 8B means, that model have 8.000.000.000 parameters. The more, the smarter LLM and the harder.
- Each parameter needs some space in VRAM. By default, 16 bit per parameter. By default, 8B model needs 16GB VRAM
- Quantation is reducing space per parameter. Q8_0 use 8 bit per parameter, Q7_0 use 7 bit, etc...
- Q8_0 is very good quantation, because it needs half VRAM's space and have quality about 98% of full model (depends on model)
- Quantation less than Q4_0 is ineffective (but it might work)

