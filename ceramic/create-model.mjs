import { writeFile } from "node:fs/promises";
import { CeramicClient } from "@ceramicnetwork/http-client";
import { ModelManager } from "@glazed/devtools";
import { DID } from "dids";
import { Ed25519Provider } from "key-did-provider-ed25519";
import { getResolver } from "key-did-resolver";
import { fromString } from "uint8arrays";
import "dotenv/config";

console.log(`DID_KEY=${process.env.DID_KEY}`);
// The key must be provided as an environment variable
const key = fromString(process.env.DID_KEY, "base16");
// Create and authenticate the DID
const did = new DID({
  provider: new Ed25519Provider(key),
  resolver: getResolver(),
});
await did.authenticate();

// Connect to the local Ceramic node
const ceramic = new CeramicClient("https://ceramic-clay.3boxlabs.com");
ceramic.did = did;

// Create a manager for the model
const manager = new ModelManager({ ceramic });

const CIDsWithKeysSchemaID = await manager.createSchema("CIDsWithKeysSchema", {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "CIDsWithKeys",
  type: "object",
  properties: {
    CIDsWithKeys: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fileName: {
            type: "string",
          },
          cid: {
            type: "string",
          },
          encryptedSymmetricKey: {
            type: "string",
          },
        },
      },
    },
  },
});

// Create the definition using the created schema ID
await manager.createDefinition("CIDsWithKeysDefinition", {
  name: "CIDs With Keys",
  description:
    "An array that holds all of the IPFS CIDs for the user's encrypted files and the cooresponding encrypted symmetric key",
  schema: manager.getSchemaURL(CIDsWithKeysSchemaID),
});

// Create a tile using the created schema ID
await manager.createTile(
  "exampleCIDsWithKeys",
  {
    CIDsWithKeys: [
      {
        fileName: "fileNameExample",
        cid: "cidExample",
        encryptedSymmetricKey: "enxryptedKeyExample",
      },
    ],
  },
  { schema: manager.getSchemaURL(CIDsWithKeysSchemaID) }
);

// Deploy model to Ceramic node
const model = await manager.deploy();

// Write deployed model aliases to JSON file
await writeFile("./ceramic/model.json", JSON.stringify(model));
