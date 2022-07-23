import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.css";
import { UploadOutlined } from "@ant-design/icons";
import { Button, Upload, List, Avatar } from "antd";
import {
  PaperClipOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import LitJsSdk from "lit-js-sdk";
import { useEffect, useState } from "react";
import { Web3Storage } from "web3.storage";
import { EthereumAuthProvider, SelfID, WebClient } from "@self.id/web";
import { saveAs } from "file-saver";

export default function Home() {
  const litClient = new LitJsSdk.LitNodeClient();
  const chain = "mumbai";
  let authSig, accessControlConditions;

  const web3StorageClient = new Web3Storage({
    token: process.env.NEXT_PUBLIC_WEB3_STORAGE_API_KEY,
  });

  const dataModeldefinition =
    "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417";

  async function connectToLit() {
    await litClient.connect();
    window.litNodeClient = litClient;
  }

  async function getAuthSig() {
    authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain,
    });
    accessControlConditions = [
      {
        contractAddress: "",
        standardContractType: "",
        chain,
        method: "",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: "=",
          value: authSig.address,
        },
      },
    ];
  }

  async function encryptFile(file) {
    const { encryptedFile, symmetricKey } = await LitJsSdk.encryptFile({
      file,
    });
    const encryptedSymmetricKey = await litClient.saveEncryptionKey({
      accessControlConditions,
      symmetricKey,
      authSig,
      chain,
    });

    return {
      encryptedFile,
      encryptedSymmetricKey: LitJsSdk.uint8arrayToString(
        encryptedSymmetricKey,
        "base16"
      ),
    };
  }

  async function uploadToWeb3Storage(blob, fileName) {
    // Pack files into a CAR and send to web3.storage
    var file = new File([blob], fileName);
    const rootCid = await web3StorageClient.put([file], {
      name: fileName,
      maxRetries: 3,
    });

    return rootCid;
  }

  async function connectToCeramic() {
    const aliases = {
      definitions: {
        CIDsWithKeysDefinition:
          "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417",
      },
      schemas: {
        CIDsWithKeysSchema:
          "ceramic://k3y52l7qbv1fryq8ri9y59t6th435v8arm4zf9fkyo5zmpq2aoeg8v2w3fhadb2tc",
      },
      tiles: {},
    };

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const authProvider = new EthereumAuthProvider(window.ethereum, accounts[0]);

    const client = new WebClient({
      ceramic: "local",
      connectNetwork: "testnet-clay",
    });

    await client.authenticate(authProvider);

    const selfId = new SelfID({ client, aliases });
    setSelf(selfId);

    const currentFiles = await selfId.get(
      "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417"
    );

    setFiles(currentFiles && currentFiles.CIDsWithKeys);
  }

  async function uploadToCeramic(fileName, cid, encryptedSymmetricKey) {
    const currentFiles = await self.get(
      "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417"
    );

    const currentArray = currentFiles ? currentFiles.CIDsWithKeys : [];

    currentArray.push({
      fileName,
      cid,
      encryptedSymmetricKey,
    });

    await self.set(
      "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417",
      {
        CIDsWithKeys: currentArray,
      }
    );

    const newFiles = await self.get(
      "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417"
    );

    setFiles(newFiles.CIDsWithKeys);
  }

  async function deleteFile(cid) {
    console.log("Executed delete function");
    const currentFiles = await self.get(
      "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417"
    );

    const currentArray = currentFiles.CIDsWithKeys;
    const newArray = new Array();
    currentArray.forEach((item) => {
      if (item.cid !== cid) {
        newArray.push(item);
      }
    });

    await self.set(
      "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417",
      {
        CIDsWithKeys: newArray,
      }
    );

    setFiles(newArray);
  }

  async function retrieveFile(cid, encryptedSymmetricKey) {
    const res = await web3StorageClient.get(cid);
    console.log(`Got a response! [${res.status}] ${res.statusText}`);
    if (!res.ok) {
      throw new Error(`failed to get ${cid}`);
    }

    // unpack File objects from the response
    const files = await res.files();
    for (const file of files) {
      console.log(`${file.cid} -- ${file.size}`);
      decryptFile(file, encryptedSymmetricKey);
    }
  }

  async function decryptFile(file, encryptedSymmetricKey) {
    const symmetricKey = await litClient.getEncryptionKey({
      accessControlConditions,
      toDecrypt: encryptedSymmetricKey,
      chain,
      authSig,
    });

    const arrayBuffer = await LitJsSdk.decryptFile({ file, symmetricKey });

    console.log(arrayBuffer);

    const blob = new Blob([arrayBuffer]);

    saveAs(blob, file.name);
  }

  const props = {
    onStart(file) {
      console.log("onStart", file, file.name);
    },
    showUploadList: false,
    async customRequest({ file, onSuccess }) {
      const { encryptedFile, encryptedSymmetricKey } = await encryptFile(file);
      const cid = await uploadToWeb3Storage(encryptedFile, file.name);
      await uploadToCeramic(file.name, cid, encryptedSymmetricKey);
      onSuccess(console.log("File Uploaded successfully!"));
    },
  };

  const [files, setFiles] = useState([]);
  const [self, setSelf] = useState();

  useEffect(() => {
    if (litClient) {
      connectToLit();
      getAuthSig();
    }
  }, [litClient]);

  useEffect(() => {
    connectToCeramic();
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>Your Drive</title>
        <meta name="description" content="Your Drive" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <Upload {...props}>
          <Button icon={<UploadOutlined />}>Upload</Button>
        </Upload>
        {files && (
          <List
            itemLayout="horizonatl"
            dataSource={files}
            bordered
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<PaperClipOutlined />}
                  title={item.fileName}
                  description={`CID: ${item.cid}`}
                />
                <div>
                  <button
                    onClick={() =>
                      retrieveFile(item.cid, item.encryptedSymmetricKey)
                    }
                  >
                    <DownloadOutlined />
                  </button>
                  <button onClick={() => deleteFile(item.cid)}>
                    <DeleteOutlined />
                  </button>
                </div>
              </List.Item>
            )}
          />
        )}
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{" "}
          <span className={styles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
    </div>
  );
}
