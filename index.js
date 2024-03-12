const {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} = require("@aws-sdk/client-transcribe");

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { OpenAI } = require("openai");
const region = "ap-southeast-1";
const fs = require("fs");

require("dotenv").config({ override: true });

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
};

//file names to use

// TranscriptionJobName: hin_eng_min_transcription_srtFormat,  Uri: hin_eng_min.mp4
// TranscriptionJobName: video_02_transcription_srtFormat,  Uri: standup_video_4mins.mp4

const input = {
  TranscriptionJobName: "video_02_transcription_srtFormat",
  Media: {
    MediaFileUri: "s3://transcription-xyz/standup_video_4mins.mp4",
  },
  OutputBucketName: "transcription-xyz",
  OutputKey: "transcriptions/",
  IdentifyLanguage: true,
  LanguageOptions: ["hi-IN", "en-US"],
  Subtitles: {
    Formats: ["srt"],
    OutputStartIndex: 1,
  },
};
const fileKey = `${input.OutputKey}${input.TranscriptionJobName}`;
const completionStatus = ["COMPLETED", "FAILED"];

async function startTranscriptionRequest() {
  console.log("Starting");
  const transcribeConfig = {
    region,
    credentials,
  };
  const transcribeClient = new TranscribeClient(transcribeConfig);
  const transcribeCommand = new StartTranscriptionJobCommand(input);
  try {
    const transcribeResponse = await transcribeClient.send(transcribeCommand);
    console.log("Transcription job created, the details:");
    console.log(transcribeResponse.TranscriptionJob);
  } catch (err) {
    console.log(err);
  }

  while (true) {
    const getTranscriptionCommand = new GetTranscriptionJobCommand({
      TranscriptionJobName: input.TranscriptionJobName,
    });
    const status = await transcribeClient.send(getTranscriptionCommand);
    if (
      completionStatus.includes(status.TranscriptionJob.TranscriptionJobStatus)
    ) {
      // const jsonFile = await getFile(`${fileKey}.json`);
      const srtFile = await getFile(`${fileKey}.srt`);
      getHinglishTranscription(srtFile);
      break;
    }
    await timeout(5000);
    console.log("Re-executing...");
  }
}

async function getFile(key) {
  const url = await getObjectURL(key);

  let res = await fetch(url)
    .then((res) => res.blob())
    .then((blob) => blob.text());
  return res;
}

async function getObjectURL(key) {
  const s3Client = new S3Client({
    region,
    credentials,
  });
  const command = new GetObjectCommand({
    Bucket: "transcription-xyz",
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command);
  // console.log(url);
  return url;
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const client = new OpenAI();
async function getHinglishTranscription(awsTranscription) {
  awsTranscription = await getFile(`${fileKey}.srt`); // when changed to srt file no need for this step
  const hinglishTranscription = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    max_tokens: Infinity,
    messages: [
      {
        role: "system",
        content: `Convert the following transcription provide by user this into Hinglish transcription, Output should be in JSON format so the system can easily just use JSON.parse method on the output provided.
           Don't make use of code block in your answer just directly send your answer because I am parsing the JSON string.
           Format the answer as follows: [{"segment": "segment in hinglish","start":"00:00:00.039","end":"00:00:01.159"},...].
           Input is an srt file so don't miss any segment or it will mess up the time for all the up segments.
           Convert Hindi Words to Hinglish and let english words be english only.`,
      },
      { role: "user", content: awsTranscription },
    ],
  });
  fs.appendFile(
    "hinglish_transcription.json",
    hinglishTranscription.choices[0].message.content,
    (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log("Successfull");
      }
    }
  );

  //Streaming response
  // const writeStream = fs.createWriteStream("hinglish_transcription.json");
  // for await (const part of hinglishTranscription) {
  //   writeStream.write(part.choices[0]?.delta?.content ?? "");
  // }
  // writeStream.end();
  // writeStream.on("finish", () => {
  //   console.log(
  //     `Streaming GPT output has been written to hinglish_transcription.json`
  //   );
  // });

  // writeStream.on("error", (err) => {
  //   console.error(`Error writing to file: ${err}`);
  // });
}
// startTranscriptionRequest();

getHinglishTranscription(""); //change to srt file later
