import fs from "fs";
import { Schema } from "./types";
import path from 'path';
import config from "./config";
import lowdb from "lowdb";
import FileAsync from "lowdb/adapters/FileAsync";
import { ChildProcess } from "child_process";
import { promisify } from "util";
import axios from "axios";

async function generateDomainsString(): Promise<string> {
  const adapter = new FileAsync<Schema>(path.join(config.db_dir, config.db_name));
  const db = await lowdb(adapter);

  const data = db.get('entries').value();
  let output: string = "";

  for(const entry of data){
    output += entry.from + " -> " + entry.to + ", ";
  }

  return output.slice(0, -2);
}

async function generateDomainsFile(): Promise<void> {
  const output: string = await generateDomainsString();
  return promisify(fs.writeFile)(path.join(config.domains_dir, config.domains_file), output);
}

function promisifyChildProcess(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {

    child.addListener("error", reject);
    child.addListener("exit", (code) => {
      console.log(`Child process exited with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        reject("Child process exited with non-zero code");
      }
    });
  });
}

async function getDAppNodeDomain(): Promise <string> {
  const url: string = "http://my.dappnode/global-envs/DOMAIN";
  const maxPolls: number = 20;
  let polls: number = 0;
  const pollingFn = (resolve, reject): void => {
      axios.get(url).then((response) => {
        polls++;
        if(response.status === 200) {
          resolve(response.data);
        } else if(polls >= maxPolls) {
          reject("Max polls exceded");
        } else {
          setTimeout(pollingFn, 1000);
        }
      }).catch((err) => {
        console.log(err);
      })
  };
  return new Promise<string>(pollingFn);
}

export { generateDomainsString, generateDomainsFile, promisifyChildProcess, getDAppNodeDomain };
