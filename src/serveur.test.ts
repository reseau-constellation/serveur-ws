import { execa } from 'execa';
import rimraf from "rimraf";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { sep, join } from "path";

import { proxy, utilsTests } from "@constl/ipa";

import lancerServeur from "@/serveur";
import générerClient from "@/client";

const faisRien = () => {return}

const typesServeurs: {[clef: string]: ()=> Promise<{fermerServeur: ()=>void, port: number}>} = {
  /*"Serveur même fil": async () => {
    const dirTemp =  mkdtempSync(`${tmpdir()}${sep}`);

    const dsfip = await utilsTests.initierSFIP(join(dirTemp, "sfip"));

    const { fermerServeur, port } = await lancerServeur({
      optsConstellation: {
        orbite: {
          dossier: join(dirTemp, "dossierSFIP"),
          sfip: { sfip: dsfip.api },
        },
        dossierStockageLocal: join(dirTemp, "stockageLocal")
      },
    });
    return {
      port,
      fermerServeur: () => {
        fermerServeur();
        utilsTests.arrêterSFIP(dsfip);
        rimraf.sync(dirTemp);
      }
    }
  },*/
  "Serveur ligne de commande": async () => {
    const abortController = new AbortController();
    const processus = execa("./dist/bin.js", ["lancer"], {signal: abortController.signal});
    const { stdout } = processus

    return new Promise(résoudre => {
      stdout.on("data", (data)=>{
        const port = Number(data.toString().split(":")[1]);
        console.log({port})

        résoudre({
          port,
          fermerServeur: () => {
            // abortController.abort();
          }
        })
      })
    })
  }
}


describe("Serveurs", function () {
  Object.entries(typesServeurs).forEach(
    ([typeServeur, fGénérerServeur]) => describe(
      typeServeur,
      function () {
        let fermerServeur: () => void;
        let port: number;

        beforeAll(async () => {
          ({ fermerServeur, port } = await fGénérerServeur());
        }, 10000);

        afterAll(async () => {
          if (fermerServeur) fermerServeur();
        });

        describe("Fonctionalités base serveur", function () {

          let fermerClient: () => void;
          let monClient: proxy.proxy.ProxyClientConstellation;

          beforeAll(async () => {
            ({ client: monClient, fermerClient } = await générerClient({port}));
          }, 10000);

          afterAll(async () => {
            if (fermerClient) fermerClient();
          });

          test("Action", async () => {
            const idOrbite = await monClient.obtIdOrbite();

            expect(typeof idOrbite).toEqual("string")
            expect(idOrbite.length).toBeGreaterThan(0);
          }, 30000);  // Beaucoup plus long pour le premier test (le serveur doit se réveiller)

          test("Suivre", async () => {
            let noms: { [key: string]: string } | undefined;

            const oublierNoms = await monClient.profil!.suivreNoms({f: (n: {[key: string]: string}) => (noms = n)});
            expect(noms).toBeTruthy();
            expect(Object.keys(noms)).toHaveLength(0);

            await monClient.profil!.sauvegarderNom({langue: "fr", nom: "Julien Jean Malard-Adam"});
            expect(noms).toEqual({ fr: "Julien Jean Malard-Adam" });

            oublierNoms();

            await monClient.profil!.sauvegarderNom({langue: "es", nom: "Julien Jean Malard-Adam"});
            expect(noms).toEqual({ fr: "Julien Jean Malard-Adam" });
          }, 10000);

          test("Erreur fonction suivi inexistante", async () => {
            // @ts-ignore
            await expect(() => monClient.jeNeSuisPasUneFonction({f: faisRien})).rejects.toThrow();
          }, 10000);
          test("Erreur action inexistante", async () => {
            // @ts-ignore
            await expect(() => monClient.jeNeSuisPasUnAtribut.ouUneFonction()).rejects.toThrow();
          }, 10000);
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
          }, 10000);

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
          }, 10000);
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
          }, 10000);

          test("Erreur action", async () => {
            // @ts-ignore
            await expect(() => client1.jeNeSuisPasUneFonction()).rejects.toThrow();

            // @ts-ignore
            await expect(() => client2.jeNeSuisPasUnAtribut.ouUneFonction()).rejects.toThrow();
          }, 10000);

          test("Erreur suivi", async () => {
            // @ts-ignore
            await expect(() => client1.jeNeSuisPasUneFonction({f: faisRien})).rejects.toThrow();

            // @ts-ignore
            await expect(() => client2.jeNeSuisPasUnAtribut.ouUneFonction({f: faisRien})).rejects.toThrow();
          }, 10000);
        });
      }
    )
  )

});
