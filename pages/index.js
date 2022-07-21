import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.css";
import { UploadOutlined } from "@ant-design/icons";
import { Button, Upload } from "antd";
import LitJsSdk from "lit-js-sdk";
import { useEffect } from "react";
import { Web3Storage } from "web3.storage";
import {
  useViewerConnection,
  useViewerRecord,
  EthereumAuthProvider,
} from "@self.id/framework";

export default function Home() {
  const litClient = new LitJsSdk.LitNodeClient();
  const chain = "mumbai";
  let authSig, accessControlConditions;

  const web3StorageClient = new Web3Storage({
    token: process.env.NEXT_PUBLIC_WEB3_STORAGE_API_KEY,
  });

  const [connection, connect, disconnect] = useViewerConnection();
  const dataModeldefinition =
    "kjzl6cwe1jw145sb2fhp7iynkoxa7obhwb2t16czkda1qznodzlreojojqnj417";
  const record = useViewerRecord(dataModeldefinition);

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
    console.log(accessControlConditions);
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
    console.log(web3StorageClient);
    var file = new File([blob], fileName);
    const rootCid = await web3StorageClient.put([file], {
      name: fileName,
      maxRetries: 3,
    });

    return rootCid;
  }

  async function connectToCeramic() {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    await connect(new EthereumAuthProvider(window.ethereum, accounts[0]));
  }

  async function uploadToCeramic(fileName, cid, encryptedSymmetricKey) {
    await record.set({ fileName, cid, encryptedSymmetricKey });
    console.log(record.content);
  }

  async function handleUpload(file, fileName) {
    const { encryptedFile, encryptedSymmetricKey } = await encryptFile(file);
    const cid = await uploadToWeb3Storage(encryptedFile, fileName);
    // await uploadToCeramic(fileName, cid, encryptedSymmetricKey);
  }

  const props = {
    customRequest({ file, fileName }) {
      handleUpload(file, fileName);
    },
  };

  useEffect(() => {
    if (litClient) {
      connectToLit();
      getAuthSig();
    }
  }, []);

  // useEffect(() => {
  //   connectToCeramic();
  // }, []);

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
