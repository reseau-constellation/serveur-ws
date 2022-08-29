import rimraf from "rimraf";

import { proxy } from "@constl/ipa";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { sep, join } from "path";

import lancerServeur from "@/serveur";
import générerClient from "@/client";


describe("Serveurs", function () {
  let fermerServeur: () => void;
  let port: number;
  let dirTemp: string;

  const effacerFichiers = () => {
    rimraf.sync(dirTemp);
  };

  beforeAll(async () => {
    dirTemp =  mkdtempSync(`${tmpdir()}${sep}`);

    ({ fermerServeur, port } = await lancerServeur({
      optsConstellation: {
        orbite: {
          dossier: join(dirTemp, "dossierSFIP"),
          sfip: {
            dossier: join(dirTemp, "dossierOrbite")
          }
        },
        dossierStockageLocal: join(dirTemp, "stockageLocal")
      },
    }));
  });

  afterAll(async () => {
    if (fermerServeur) fermerServeur();
    effacerFichiers();
  });

  describe("Fonctionalités base serveur", function () {

    let fermerClient: () => void;
    let monClient: proxy.proxy.ProxyClientConstellation;

    beforeAll(async () => {
      ({ client: monClient, fermerClient } = await générerClient(port));
    }, 10000);

    afterAll(async () => {
      if (fermerClient) fermerClient();
    });

    test("Action", async () => {
      const idOrbite = await monClient.obtIdOrbite();

      expect(typeof idOrbite).toEqual("string")
      expect(idOrbite.length).toBeGreaterThan(0);
    });

    test("Suivre", async () => {
      let noms: { [key: string]: string } | undefined;

      const oublierNoms = await monClient.profil!.suivreNoms({f: (n) => (noms = n)});
      expect(noms).toBeTruthy();
      expect(Object.keys(noms)).toHaveLength(0);

      await monClient.profil!.sauvegarderNom({langue: "fr", nom: "Julien Jean Malard-Adam"});
      expect(noms).toEqual({ fr: "Julien Jean Malard-Adam" });

      oublierNoms();

      await monClient.profil!.sauvegarderNom({langue: "es", nom: "Julien Jean Malard-Adam"});
      expect(noms).toEqual({ fr: "Julien Jean Malard-Adam" });
    });

    test("Erreur", async () => {
      // @ts-ignore
      expect(() => monClient.jeNeSuisPasUneFonction()).toThrow;

      // @ts-ignore
      expect(() => monClient.jeNeSuisPasUnAtribut.ouUneFonction()).toThrow;
    });
  });

  describe("Multiples clients", function () {

    let client1: proxy.proxy.ProxyClientConstellation;
    let client2: proxy.proxy.ProxyClientConstellation;

    let fermerClient1: () => void;
    let fermerClient2: () => void;
    const fsOublier: (() => void)[] = [];

    beforeAll(async () => {
      ({ client: client1, fermerClient: fermerClient1 } = await générerClient(port));
      ({ client: client2, fermerClient: fermerClient2 } = await générerClient(port));
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
    });
    test("Suivre", async () => {
      let courriel1: string | null = null;
      let courriel2: string | null = null;

      fsOublier.push(
        await client1.profil!.suivreCourriel(
          { f: (courriel) => (courriel1 = courriel) }
        )
      );
      fsOublier.push(
        await client2.profil!.suivreCourriel(
          { f: (courriel) => (courriel2 = courriel) }
        )
      );

      await client1.profil!.sauvegarderCourriel({ courriel: "julien.malard@mail.mcgill.ca" });
      await new Promise((résoudre) => setTimeout(résoudre, 2000));

      expect(courriel1).toEqual("julien.malard@mail.mcgill.ca");
      expect(courriel2).toEqual("julien.malard@mail.mcgill.ca");
    });

    test("Erreur", async () => {
      // @ts-ignore
      expect(() => client1.jeNeSuisPasUneFonction()).to.throw;

      // @ts-ignore
      expect(() => client2.jeNeSuisPasUnAtribut.ouUneFonction()).to.throw;
    });
  });
});
