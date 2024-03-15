const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");

//function to get File from S3 bucket
async function getFile(key, region, credentials) {
  const url = await getObjectURL(key, region, credentials);

  let res = await fetch(url)
    .then((res) => res.blob())
    .then((blob) => blob.text());
  return res;
}

// get object url of an object in s3 bucket using it's key
async function getObjectURL(key, region, credentials) {
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

//fake timeout function
function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// add output to file to view it
async function addToFile(filename, data) {
  fs.appendFile(filename, data, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Successfull added to:", filename);
    }
  });
}

//check if directory exists and create if it doesn't
function createDir(dirName) {
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }
}

function deleteFile(fileName) {
  if (fs.existsSync(fileName)) {
    fs.unlink(fileName, (err) => {
      if (err) throw err;
      console.log("deleted", fileName);
    });
  }
}
//function to convert json to srt and add it to hingligh.srt file
async function jsonToSrt(json, srtFileName) {
  let srt = "";
  for (let i = 0; i < json.length; i++) {
    const { segment, start, end } = json[i];
    let data = `${i + 1}
${start.replace(".", ",")} --> ${end.replace(".", ",")}
${segment}

`;
    srt += data;
    await addToFile(srtFileName, data);
    await timeout(2);
  }
  return srt;
}

// Converts file content tot string
function readFileToString(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

//divides srt file in chunks of 50 time segments.
function parseSRT(srtContent) {
  const lines = srtContent.trim().split("\n");
  const transcriptions = [];
  let combinedText = "";
  for (let i = 0; i < lines.length; i += 4) {
    const text = `${lines[i]}
${lines[i + 1]}
${lines[i + 2]}`;
    combinedText += text + "\n\n";
    if (i !== 0 && i % 200 === 0) {
      transcriptions.push(combinedText);
      combinedText = "";
      continue;
    }
  }
  if (combinedText) transcriptions.push(combinedText);
  return transcriptions;
}

module.exports = {
  getObjectURL,
  getFile,
  timeout,
  addToFile,
  jsonToSrt,
  readFileToString,
  parseSRT,
  createDir,
  deleteFile,
};
