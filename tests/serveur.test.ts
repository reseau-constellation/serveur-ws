import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import rimraf from "rimraf";

import { proxy } from "@constl/ipa";

import { EncryptionBidon } from "./utils";

import lancerServeur from "@/serveur";
import générerClient from "@/client";


chai.should();
chai.use(chaiAsPromised);

const effacerFichiers = () => {
  rimraf.sync("orbite-cnstl");
  rimraf.sync("sfip-cnstl");
  rimraf.sync("_stockageTemp");
};

describe("Serveurs", function () {
  let fermerServeur: () => void;
  let port: number;

  before(async () => {
    ({ fermerServeur, port } = await lancerServeur({
      optsConstellation: { encryption: new EncryptionBidon() },
    }));
  });

  after(async () => {
    if (fermerServeur) fermerServeur();
    effacerFichiers();
  });

  describe("Fonctionalités base serveur", function () {
    this.timeout(10000);

    let fermerClient: () => void;
    let monClient: proxy.proxy.ProxyClientConstellation;

    before(async () => {
      ({ client: monClient, fermerClient } = await générerClient(port));
    });

    after(async () => {
      if (fermerClient) fermerClient();
    });

    it("Action", async () => {
      const idOrbite = await monClient.obtIdOrbite();

      expect(idOrbite).to.be.a("string").and.to.not.be.empty;
    });

    it("Suivre", async () => {
      let noms: { [key: string]: string } | undefined;

      const oublierNoms = await monClient.profil!.suivreNoms((n) => (noms = n));
      expect(noms).to.exist.and.to.be.an.empty("object");

      await monClient.profil!.sauvegarderNom("fr", "Julien Jean Malard-Adam");
      expect(noms).to.deep.equal({ fr: "Julien Jean Malard-Adam" });

      oublierNoms();

      await monClient.profil!.sauvegarderNom("es", "Julien Jean Malard-Adam");
      expect(Object.keys(noms!))
        .to.have.lengthOf(1)
        .and.include.members(["fr"]);
    });

    it("Erreur", async () => {
      // @ts-ignore
      expect(() => monClient.jeNeSuisPasUneFonction()).to.throw;

      // @ts-ignore
      expect(() => monClient.jeNeSuisPasUnAtribut.ouUneFonction()).to.throw;
    });
  });

  describe("Multiples clients", function () {
    this.timeout(10000);

    let client1: proxy.proxy.ProxyClientConstellation;
    let client2: proxy.proxy.ProxyClientConstellation;

    let fermerClient1: () => void;
    let fermerClient2: () => void;
    const fsOublier: (() => void)[] = [];

    before(async () => {
      ({ client: client1, fermerClient: fermerClient1 } = await générerClient(port));
      ({ client: client2, fermerClient: fermerClient2 } = await générerClient(port));
    });

    after(() => {
      if (fermerClient1) fermerClient1();
      if (fermerClient2) fermerClient2();
      fsOublier.forEach((f) => f());
    });

    it("Action", async () => {
      const [idOrbite1, idOrbite2] = await Promise.all([
        client1.obtIdOrbite(),
        client2.obtIdOrbite(),
      ]);
      expect(idOrbite1).to.be.a("string").that.is.not.empty;
      expect(idOrbite2).to.be.a("string").that.is.not.empty;
      expect(idOrbite1).to.equal(idOrbite2);
    });
    it("Suivre", async () => {
      let courriel1: string | null = null;
      let courriel2: string | null = null;

      fsOublier.push(
        await client1.profil!.suivreCourriel(
          (courriel) => (courriel1 = courriel)
        )
      );
      fsOublier.push(
        await client2.profil!.suivreCourriel(
          (courriel) => (courriel2 = courriel)
        )
      );

      await client1.profil!.sauvegarderCourriel("julien.malard@mail.mcgill.ca");
      await new Promise((résoudre) => setTimeout(résoudre, 2000));
      expect(courriel1)
        .to.equal(courriel2)
        .to.equal("julien.malard@mail.mcgill.ca");
    });

    it("Erreur", async () => {
      // @ts-ignore
      expect(() => client1.jeNeSuisPasUneFonction()).to.throw;

      // @ts-ignore
      expect(() => client2.jeNeSuisPasUnAtribut.ouUneFonction()).to.throw;
    });
  });
});
