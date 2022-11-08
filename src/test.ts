#!/usr/bin/env node --experimental-specifier-resolution=node
import { proxy } from "@constl/ipa";

// https://www.codeheroes.fr/2020/10/02/profiler-son-application-node-js-analyse-des-performances-cpu/

const client = proxy.ipa.générerProxyProc()

const idBd = await client.bds!.créerBd({licence: "ODbl-1_0"})
console.log({idBd});
