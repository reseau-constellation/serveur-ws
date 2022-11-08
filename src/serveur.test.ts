import { execa } from 'execa';
import rimraf from "rimraf";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { sep, join } from "path";

import { proxy, utilsTests, version as versionIPA } from "@constl/ipa";

import lancerServeur from "@/serveur";
import générerClient from "@/client";
import {version} from "@/version"

const faisRien = () => {return}


const limTempsPremierTest = (typeServeur: string) => {
  return typeServeur === "Serveur ligne de commande" ? 5 * 60 * 1000 : 10000
}

const limTempsTest = (typeServeur: string) => {
  return typeServeur === "Serveur ligne de commande" ? 10 * 1000 : 5000
}

const typesServeurs: () => {[clef: string]: ()=> Promise<{fermerServeur: ()=>Promise<void>, port: number}>} = () => {
  const typesFinaux: {[clef: string]: ()=> Promise<{fermerServeur: ()=>Promise<void>, port: number}>} = {}
  if (process.env.TYPE_SERVEUR === "proc" || !process.env.TYPE_SERVEUR) {
    typesFinaux["Serveur même fil"] = async () => {
      const dirTemp =  mkdtempSync(`${tmpdir()}${sep}`);

      const dsfip = await utilsTests.initierSFIP(join(dirTemp, "sfip"));

      const { fermerServeur, port } = await lancerServeur({
        optsConstellation: {
          orbite: {
            dossier: join(dirTemp, "orbite"),
            sfip: { sfip: dsfip.api },
          },
          dossierStockageLocal: join(dirTemp, "stockageLocal")
        },
      });
      return {
        port,
        fermerServeur: async () => {
          await fermerServeur();
          await utilsTests.arrêterSFIP(dsfip);
          rimraf.sync(dirTemp);
        }
      }
    }
  }

  if (process.env.TYPE_SERVEUR === "bin" || !process.env.TYPE_SERVEUR) {
    typesFinaux["Serveur ligne de commande"] = () => {
      const dirTemp =  mkdtempSync(`${tmpdir()}${sep}`);
      const dossierSFIP = join(dirTemp, "sfip")
      const dossierOrbite = join(dirTemp, "orbite")
      const processus = execa("./dist/bin.js", ["lancer", `--doss-sfip=${dossierSFIP}`, `--doss-orbite=${dossierOrbite}`]);
      const { stdout } = processus

      return new Promise(résoudre => {
        stdout.on("data", (data)=>{
          const port = Number(data.toString().split(":")[1]);
          if (port) {
            résoudre({
              port,
              fermerServeur: async () => {
                processus.kill('SIGTERM', {
              		forceKillAfterTimeout: 2000
              	});
                rimraf.sync(dirTemp);
              }
            })
          }

        })
      })
    }
  }
  return typesFinaux
}


if (process.env.TYPE_SERVEUR === "bin") {
  describe("Client ligne de commande", () => {
    test("Obtenir version serveur", async () => {
      const {stdout} = await execa("./dist/bin.js", ["version"]);
      expect(stdout).toEqual(version)
    })
    test("Obtenir version IPA", async () => {
      const {stdout} = await execa("./dist/bin.js", ["v-constl"]);
      expect(stdout).toEqual(versionIPA)
    })
  })
}


describe("Serveurs", function () {
  Object.entries(typesServeurs()).forEach(
    ([typeServeur, fGénérerServeur]) => describe(
      typeServeur,
      () => {
        let fermerServeur: () => Promise<void>;
        let port: number;

        beforeAll(async () => {
          ({ fermerServeur, port } = await fGénérerServeur());
        }, limTempsTest(typeServeur));

        afterAll(async () => {
          if (fermerServeur) await fermerServeur();
        }, limTempsTest(typeServeur));

        describe("Fonctionalités base serveur", () => {

          let fermerClient: () => void;
          let monClient: proxy.proxy.ProxyClientConstellation;

          beforeAll(async () => {
            ({ client: monClient, fermerClient } = await générerClient({port}));
          }, limTempsTest(typeServeur));

          afterAll(() => {
            if (fermerClient) fermerClient();
          });

          test("Action", async () => {
            const idOrbite = await monClient.obtIdOrbite();

            expect(typeof idOrbite).toEqual("string")
            expect(idOrbite.length).toBeGreaterThan(0);
          }, limTempsPremierTest(typeServeur));  // Beaucoup plus long pour le premier test (le serveur doit se réveiller)

          test("Suivre", async () => {
            const no: {ms?: { [key: string]: string }} = {};

            const oublierNoms = await monClient.profil!.suivreNoms({f: (n: {[key: string]: string}) => (no.ms = n)});

            await utilsTests.attendreRésultat(no, "ms")
            expect(no.ms).toBeTruthy();
            expect(Object.keys(no.ms)).toHaveLength(0);

            await monClient.profil!.sauvegarderNom({langue: "fr", nom: "Julien Jean Malard-Adam"});
            expect(no.ms).toEqual({ fr: "Julien Jean Malard-Adam" });

            oublierNoms();

            await monClient.profil!.sauvegarderNom({langue: "es", nom: "Julien Jean Malard-Adam"});
            expect(no.ms).toEqual({ fr: "Julien Jean Malard-Adam" });
          }, limTempsTest(typeServeur));

          test.skip("Rechercher", async () => {
            // Eléments détectés
            // Augmenter N résultats désirés
            // Diminuer N
          });

          test("Erreur fonction suivi inexistante", async () => {
            // @ts-ignore
            await expect(() => monClient.jeNeSuisPasUneFonction({f: faisRien})).rejects.toThrow();
          }, limTempsTest(typeServeur));
          test("Erreur action inexistante", async () => {
            // @ts-ignore
            await expect(() => monClient.jeNeSuisPasUnAtribut.ouUneFonction()).rejects.toThrow();
          }, limTempsTest(typeServeur));
        });

        describe("Multiples clients", function () {

          let client1: proxy.proxy.ProxyClientConstellation;
          let client2: proxy.proxy.ProxyClientConstellation;

          let fermerClient1: () => void;
          let fermerClient2: () => void;
          const fsOublier: (() => void)[] = [];

          beforeAll(async () => {
            ({ client: client1, fermerClient: fermerClient1 } = await générerClient({port}));
            ({ client: client2, fermerClient: fermerClient2 } = await générerClient({port}));
          }, limTempsTest(typeServeur));

          afterAll(() => {
            if (fermerClient1) fermerClient1();
            if (fermerClient2) fermerClient2();
            fsOublier.forEach((f) => f());
          });

          test("Action", async () => {
            const [idOrbite1, idOrbite2] = await Promise.all([
              client1.obtIdOrbite(),
              client2.obtIdOrbite(),
            ]);
            expect(typeof idOrbite1).toEqual("string")
            expect(idOrbite1.length).toBeGreaterThan(0);
            expect(typeof idOrbite2).toEqual("string");
            expect(idOrbite2.length).toBeGreaterThan(0);
            expect(idOrbite1).toEqual(idOrbite2);
          }, limTempsTest(typeServeur));
          test("Suivre", async () => {
            let courriel1: string | null = null;
            let courriel2: string | null = null;

            fsOublier.push(
              await client1.profil!.suivreCourriel(
                { f: (courriel: string) => (courriel1 = courriel) }
              )
            );
            fsOublier.push(
              await client2.profil!.suivreCourriel(
                { f: (courriel: string) => (courriel2 = courriel) }
              )
            );

            await client1.profil!.sauvegarderCourriel({ courriel: "julien.malard@mail.mcgill.ca" });
            await new Promise((résoudre) => setTimeout(résoudre, 2000));

            expect(courriel1).toEqual("julien.malard@mail.mcgill.ca");
            expect(courriel2).toEqual("julien.malard@mail.mcgill.ca");
          }, limTempsTest(typeServeur));

          test.skip("Rechercher", async () => {
            // Eléments détectés
            // Augmenter N résultats désirés
            // Diminuer N
          });

          test("Erreur action", async () => {
            // @ts-ignore
            await expect(() => client1.jeNeSuisPasUneFonction()).rejects.toThrow();

            // @ts-ignore
            await expect(() => client2.jeNeSuisPasUnAtribut.ouUneFonction()).rejects.toThrow();
          }, limTempsTest(typeServeur));

          test("Erreur suivi", async () => {
            // @ts-ignore
            await expect(() => client1.jeNeSuisPasUneFonction({f: faisRien})).rejects.toThrow();

            // @ts-ignore
            await expect(() => client2.jeNeSuisPasUnAtribut.ouUneFonction({f: faisRien})).rejects.toThrow();
          }, limTempsTest(typeServeur));
        });
      }
    )
  )

});
