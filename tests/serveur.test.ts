import trouverUnPort from "find-free-port";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import rimraf from "rimraf";

chai.should();
chai.use(chaiAsPromised);

import { proxy } from "@constl/ipa"
// import { adresseOrbiteValide } from "@constl/ipa/client";

import générerClient from "@/client";
import lancerServeur from "@/serveur";


describe("Serveurs", function () {

  after(() => {
    rimraf.sync("orbitdb");
    rimraf.sync("sfip-cnstl");
    rimraf.sync("_stockageTemp");
  })

  describe("Fonctionalités base serveur", function () {
    this.timeout(10000);
    let monClient:  proxy.proxy.ProxyClientConstellation;
    let fermerServeur: () => void
    let fermerClient: () => void

    before(async ()=>{
      const port = (await trouverUnPort(5000))[0];

      fermerServeur = lancerServeur(port);
      ({client: monClient, fermerClient } = générerClient(port));
    })

    after(async() => {
      fermerServeur();
      fermerClient();
    })

    it("Action", async () => {
      const idOrbite = await monClient.obtIdOrbite()

      expect(idOrbite).to.be.a("string")
      expect(idOrbite.length).to.equal(66)
    })

    it("Suivre", async () => {
      let noms: {[key: string]: string} | undefined = undefined;

      const oublierNoms = await monClient.compte!.suivreNoms(n=>noms=n);
      expect(noms).to.exist.and.to.be.an.empty("object");

      await monClient.compte!.sauvegarderNom("fr", "Julien Jean Malard-Adam");
      expect(noms).to.deep.equal({fr: "Julien Jean Malard-Adam"});

      oublierNoms()

      await monClient.compte!.sauvegarderNom("es", "Julien Jean Malard-Adam");
      expect(Object.keys(noms!)).to.have.lengthOf(1).and.include.members(["fr"])
    })

    it("Erreur", async () => {
      // @ts-ignore
      expect(() => monClient.jeNeSuisPasUneFonction()).to.throw;

      // @ts-ignore
      expect(() => monClient.jeNeSuisPasUnAtribut.ouUneFonction()).to.throw;
    })
  })

  describe("Multiples clients", function () {
    this.timeout(10000);

    let client1: proxy.proxy.ProxyClientConstellation;
    let client2: proxy.proxy.ProxyClientConstellation;

    let fermerServeur: () => void;
    let fermerClient1: () => void;
    let fermerClient2: () => void;

    before(async ()=>{
      const port = (await trouverUnPort(5000))[0];
      fermerServeur = lancerServeur(port);
      ({client: client1, fermerClient: fermerClient1 } = générerClient(port));
      ({client: client2, fermerClient: fermerClient2 } = générerClient(port));
    })

    after( () => {
      fermerClient1()
      fermerClient2()
      fermerServeur()
    })

    it("Action", async () => {
      const [idOrbite1, idOrbite2] = await Promise.all([client1.obtIdOrbite(), client2.obtIdOrbite()]);
      expect(idOrbite1).to.be.a("string");
      expect(idOrbite1).to.equal(idOrbite2);
    })
    it("Suivre")

    it("Erreur")
  })
})
