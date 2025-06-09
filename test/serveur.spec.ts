import whyIsNodeRunning from 'why-is-node-running' // should be your first import
import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";

import { version as versionIPA, types, client } from "@constl/ipa";
import { attente, dossiers } from "@constl/utils-tests";

import { MandataireConstellation } from "@constl/mandataire";

import { lancerServeur } from "@/serveur.js";
import { demanderAccès, lancerClient } from "@/client.js";
import { version } from "@/version.js";
import { MessageBinaire, PRÉFIX_MACHINE } from "@/const.js";
import { expect } from "aegir/chai";
import { obtenir } from "@constl/utils-ipa";
import {
  schémaFonctionOublier,
  schémaFonctionSuivi,
} from "@constl/ipa/dist/types";

// Quand ça plante avec throw new Error('Listener is not ready yet');
// ps -ef | grep "node" | grep -v grep
// kill [-9] <idp>

const faisRien = () => {
  return;
};

const analyserMessage = (message: string): MessageBinaire | undefined => {
  if (!message.startsWith(PRÉFIX_MACHINE)) return;
  try {
    return JSON.parse(message.split(PRÉFIX_MACHINE)[1]);
  } catch (e) {
    console.log(message)
    throw e
  }
};

const typesServeurs: () => {
  [clef: string]: ({ dossier }: { dossier?: string }) => Promise<{
    fermerServeur: () => Promise<void>;
    port: number;
    codeSecret: string;
    suivreRequêtes?: (f: (x: string[]) => void) => () => void;
    suivreConnexions?: (f: (x: string[]) => void) => () => void;
    approuverRequête?: (id: string) => void;
    refuserRequête?: (id: string) => void;
  }>;
} = () => {
  const typesFinaux: {
    [clef: string]: ({ dossier }: { dossier?: string }) => Promise<{
      fermerServeur: () => Promise<void>;
      port: number;
      codeSecret: string;
    }>;
  } = {};
  if (process.env.TYPE_SERVEUR === "proc" || !process.env.TYPE_SERVEUR) {
    typesFinaux["Serveur même fil"] = async ({
      dossier,
    }: {
      dossier?: string;
    }) => {
      let fEffacer: () => void;

      if (dossier) {
        fEffacer = faisRien;
      } else {
        ({ dossier, fEffacer } = await dossiers.dossierTempo());
      }

      const {
        fermerServeur,
        port,
        codeSecret,
        suivreRequêtes,
        refuserRequête,
        approuverRequête,
        suivreConnexions,
      } = await lancerServeur({
        optsConstellation: {
          dossier,
        },
      });
      return {
        port,
        codeSecret,
        suivreRequêtes,
        refuserRequête,
        approuverRequête,
        suivreConnexions,
        fermerServeur: async () => {
          await fermerServeur();
          try {
            fEffacer();
          } catch (e) {
            console.error(e);
          }
        },
      };
    };
  }

  if (process.env.TYPE_SERVEUR === "bin" || !process.env.TYPE_SERVEUR) {
    typesFinaux["Serveur ligne de commande"] = async ({
      dossier,
    }: {
      dossier?: string;
    }) => {
      let fEffacer: () => void;

      if (dossier) {
        fEffacer = faisRien;
      } else {
        ({ dossier, fEffacer } = await dossiers.dossierTempo());
      }

      const { stdout, stdin, stderr } = execa("./dist/src/bin.js", [
        "lancer",
        "-m",
        `--dossier=${dossier}`,
      ]);
      stderr?.on("data", (d) => {
        console.warn(d.toString());
      });

      const fermerServeur = () => {
        const promesseFermer = new Promise<void>((résoudre) => {
          stdout?.on("data", (données) => {
            const message = analyserMessage(données.toString());

            if (message && message.type === "NŒUD FERMÉ") {
              try {
                fEffacer();
              } catch (e) {
                console.error(e);
              }
              résoudre();
            }
          });
        });
        stdin?.write("\n");
        return promesseFermer;
      };

      return new Promise((résoudre) => {
        stdout?.on("data", (d) => {
          const données = d.toString();

          const lignes = données.split("\n");

          for (const l of lignes) {
            const message = analyserMessage(l);

            if (message && message.type === "NŒUD PRÊT") {
              résoudre({
                port: message.port,
                codeSecret: message.codeSecret,
                fermerServeur,
              });
            }
          }
        });
      });
    };
  }
  return typesFinaux;
};

if (process.env.TYPE_SERVEUR === "bin") {
  describe("Client ligne de commande", () => {
    it("Obtenir version serveur", async () => {
      const { stdout } = await execa("./dist/src/bin.js", ["version"]);
      expect(stdout).to.equal(version);
    });
    it("Obtenir version IPA", async () => {
      const { stdout } = await execa("./dist/src/bin.js", ["v-constl"]);
      expect(stdout).to.equal(versionIPA);
    });
  });
}

describe.skip("Configuration serveur", function () {
  Object.entries(typesServeurs()).forEach(([typeServeur, fGénérerServeur]) =>
    describe(typeServeur, () => {
      let fermerServeur: () => Promise<void>;
      let dossier: string;
      let fEffacer: () => void;
      const fsOublier: (() => void)[] = [];

      before(async () => {
        ({ dossier, fEffacer } = await dossiers.dossierTempo());
        ({ fermerServeur } = await fGénérerServeur({
          dossier,
        }));
      });

      after(async () => {
        await fermerServeur();

        try {
          fEffacer?.();
        } catch (e) {
          console.error(e);
        }
        await Promise.all(fsOublier.map((f) => f()));
      });

      it("Dossier compte", async () => {
        const attendreSFIPExiste = new attente.AttendreFichierExiste(
          join(dossier, "sfip"),
        );
        fsOublier.push(() => attendreSFIPExiste.annuler());

        await attendreSFIPExiste.attendre();
        expect(existsSync(join(dossier, "sfip"))).to.be.true();
      });
    }),
  );
});

describe.skip("Fermeture serveur sécuritaire", function () {
  Object.entries(typesServeurs()).forEach(([typeServeur, fGénérerServeur]) =>
    describe(typeServeur, () => {
      it("Fermeture suivant ouverture", async () => {
        const { fermerServeur } = await fGénérerServeur({});
        await fermerServeur();
      });
    }),
  );
});

describe("Fonctionalités serveurs", function () {
  Object.entries(typesServeurs()).forEach(([typeServeur, fGénérerServeur]) =>
    describe(typeServeur, () => {
      let fermerServeur: () => Promise<void>;
      let port: number;
      let codeSecret: string;
      let suivreRequêtes:
        | ((f: schémaFonctionSuivi<string[]>) => Promise<schémaFonctionOublier>)
        | undefined;
      let approuverRequête: ((id: string) => void) | undefined;
      let refuserRequête: ((id: string) => void) | undefined;
      let suivreConnexions:
        | ((f: schémaFonctionSuivi<string[]>) => Promise<schémaFonctionOublier>)
        | undefined;
      
      const formatterFSuivre = <T>(f: (fSuivi: (x: T) => void) => () => void): ((f: schémaFonctionSuivi<T>)=>Promise<schémaFonctionOublier>) => {
        return (fSuivi: schémaFonctionSuivi<T>) => {
          const fOublier = f(fSuivi);
          return (
            async () => async () =>
              fOublier?.()
          )();
        }
      }

      before(async () => {
        const serveur = await fGénérerServeur({});
        ({ fermerServeur, port, codeSecret, refuserRequête, approuverRequête } = serveur);

        suivreRequêtes = serveur.suivreRequêtes ? formatterFSuivre(serveur.suivreRequêtes) : undefined;
        
        suivreConnexions = serveur.suivreConnexions ? formatterFSuivre(serveur.suivreConnexions) : undefined;
      });

      after(async () => {
        if (fermerServeur) {
          await fermerServeur();
          console.log("là");
        }
        setTimeout(() => whyIsNodeRunning(), 5000)
      });

      describe.skip("Authentification", () => {
        it("Connection sans mot de passe rejetée", async () => {
          // @ts-expect-error On fait exprès d'oublier le mot de passe
          await expect(lancerClient({ port })).to.be.rejectedWith("401");
        });
        it("Connection avec mauvais mot de passe rejetée", async () => {
          await expect(
            lancerClient({
              port,
              codeSecret: "Je ne suis pas le mot de passe secret.",
            }),
          ).to.be.rejectedWith("401");
        });

        describe("Demandes mot de passe", function () {
          if (typeServeur.includes("ligne de commande")) return;

          let demande: Promise<{
            codeSecret: string;
          }>;
          let codeSecretUnique: string;
          const fsOublier: (() => void)[] = [];

          after(async () => {
            await Promise.allSettled(fsOublier.map((f) => f()));
          });

          it("Suivi demandes de mot de passe", async () => {
            demande = demanderAccès({ port, monId: "Patte blanche" });

            const requêtes = await obtenir<string[]>(({ siPasVide }) =>
              suivreRequêtes!(siPasVide()),
            );
            expect(requêtes).to.include("Patte blanche");

            // Aucune connexion active pour l'instant
            const connexions = await obtenir<string[]>(({ siDéfini }) =>
              suivreConnexions!(siDéfini()),
            );
            expect(connexions).to.be.empty();
          });

          it("Rejet demande de mot de passe", async () => {
            refuserRequête?.("Patte blanche");
            await expect(demande).to.be.rejected();

            const requêtes = await obtenir<string[]>(({ si }) =>
              suivreRequêtes!(si((x) => !x.includes("Patte blanche"))),
            );
            expect(requêtes).to.be.empty();
          });

          it("Acceptation demande mot de passe", async () => {
            const nouvelleDemande = demanderAccès({
              port,
              monId: "S'il te plaît...",
            });
            await obtenir<string[]>(({ si }) =>
              suivreRequêtes!(si((x) => !!x.includes("S'il te plaît..."))),
            );

            approuverRequête?.("S'il te plaît...");

            ({ codeSecret: codeSecretUnique } = await nouvelleDemande);

            const requêtes = await obtenir<string[]>(({ si }) =>
              suivreRequêtes!(si((x) => !x.includes("S'il te plaît..."))),
            );
            expect(requêtes).to.be.empty();

            const { fermerClient } = await lancerClient({
              port,
              codeSecret: codeSecretUnique,
            });
            fsOublier.push(fermerClient);
          });

          it("Connexion détectée", async () => {
            const connexions = await obtenir<string[]>(({ siPasVide }) =>
              suivreConnexions!(siPasVide()),
            );
            expect(connexions).to.contain("S'il te plaît...");
          });

          it("Mot de passe unique non réutilisable", async () => {
            await expect(
              lancerClient({ port, codeSecret: codeSecretUnique }),
            ).to.be.rejectedWith("401");
          });
        });
      });

      describe.skip("Fonctionalités base serveur", () => {
        let fermerClient: () => void;
        let monClient: MandataireConstellation<client.Constellation>;
        const attendreNoms = new attente.AttendreRésultat<{
          [clef: string]: string;
        }>();
        const attendreMC = new attente.AttendreRésultat<
          types.résultatRecherche<types.infoRésultatTexte>[]
        >();

        before(async () => {
          ({ client: monClient, fermerClient } = await lancerClient({
            port,
            codeSecret,
          }));
        });

        after(async () => {
          if (fermerClient) fermerClient();
          attendreNoms.toutAnnuler();
          attendreMC.toutAnnuler();
        });

        it("Action", async () => {
          const idDispositif = await monClient.obtIdDispositif();

          expect(typeof idDispositif).to.equal("string");
          expect(idDispositif.length).to.be.greaterThan(0);
        });

        it("Suivre", async () => {
          const oublierNoms = await monClient.profil.suivreNoms({
            f: (n) => attendreNoms.mettreÀJour(n),
          });

          const val = await attendreNoms.attendreExiste();
          expect(Object.keys(val)).to.be.empty();

          await monClient.profil.sauvegarderNom({
            langue: "fr",
            nom: "Julien Jean Malard-Adam",
          });
          const val2 = await attendreNoms.attendreQue(
            (x) => Object.keys(x).length > 0,
          );
          expect(val2).to.deep.equal({ fr: "Julien Jean Malard-Adam" });

          await oublierNoms();

          await monClient.profil.sauvegarderNom({
            langue: "es",
            nom: "Julien Jean Malard-Adam",
          });
          expect(attendreNoms.val).to.deep.equal({
            fr: "Julien Jean Malard-Adam",
          });
        });

        it("Rechercher", async () => {
          // Eléments détectés
          const { fOublier, fChangerN } =
            await monClient.recherche.rechercherMotsClefsSelonNom({
              nomMotClef: "Météo Montréal",
              f: (x) => attendreMC.mettreÀJour(x),
              nRésultatsDésirés: 1,
            });

          const idMotClef1 = await monClient.motsClefs.créerMotClef();
          await monClient.motsClefs.sauvegarderNomsMotClef({
            idMotClef: idMotClef1,
            noms: { fr: "Météo à Montréal" },
          });

          const idMotClef2 = await monClient.motsClefs.créerMotClef();
          await monClient.motsClefs.sauvegarderNomsMotClef({
            idMotClef: idMotClef2,
            noms: { fr: "Météo Montréal" },
          });

          const val = await attendreMC.attendreQue(
            (x) => x.length > 0 && x[0].id === idMotClef2,
          );
          expect(val.map((r) => r.id)).to.have.members([idMotClef2]);

          // Augmenter N résultats désirés
          await fChangerN(2);
          const val2 = await attendreMC.attendreQue((x) => x.length > 1);
          expect(val2.map((r) => r.id)).to.have.members([
            idMotClef1,
            idMotClef2,
          ]);

          // Diminuer N
          await fChangerN(1);
          const val3 = await attendreMC.attendreQue((x) => x.length <= 1);
          expect(val3.map((r) => r.id)).to.have.members([idMotClef2]);

          await fOublier();
        });

        it("Erreur fonction suivi inexistante", async () => {
          await expect(
            // @ts-expect-error On fait exprès
            monClient.jeNeSuisPasUneFonction({ f: faisRien }),
          ).to.be.rejected();
        });

        it("Erreur action inexistante", async () => {
          await expect(
            // @ts-expect-error On fait exprès
            monClient.jeNeSuisPasUnAtribut.ouUneFonction(),
          ).to.be.rejected();
        });
      });

      describe("Multiples clients", function () {
        let client1: MandataireConstellation<client.Constellation>;
        let client2: MandataireConstellation<client.Constellation>;

        let fermerClient1: () => Promise<void>;
        let fermerClient2: () => Promise<void>;

        const attendreVars1 = new attente.AttendreRésultat<
          types.résultatRecherche<types.infoRésultatTexte>[]
        >();
        const attendreVars2 = new attente.AttendreRésultat<
          types.résultatRecherche<types.infoRésultatTexte>[]
        >();

        before(async () => {
          ({ client: client1, fermerClient: fermerClient1 } =
            await lancerClient({ port, codeSecret }));
          ({ client: client2, fermerClient: fermerClient2 } =
            await lancerClient({ port, codeSecret }));
        });

        after(async () => {
          if (fermerClient1) await fermerClient1();
          if (fermerClient2) await fermerClient2();
          attendreVars1.toutAnnuler();
          attendreVars2.toutAnnuler();
        });

        it("Action", async () => {
          const [idDispositif1, idDispositif2] = await Promise.all([
            client1.obtIdDispositif(),
            client2.obtIdDispositif(),
          ]);
          expect(typeof idDispositif1).to.equal("string");
          expect(idDispositif1.length).to.be.greaterThan(0);

          expect(idDispositif1).to.equal(idDispositif2);
        });

        it("Suivre", async () => {
          await client1.profil.sauvegarderCourriel({
            courriel: "julien.malard@mail.mcgill.ca",
          });

          const courrielVuParClient1 = await obtenir<string | null>(
            ({ siDéfini }) =>
              client1.profil.suivreCourriel({
                f: siDéfini(),
              }),
          );
          /*const courrielVuParClient2 = await obtenir<string | null>(
            ({ siDéfini }) =>
              client2.profil.suivreCourriel({
                f: siDéfini(),
              }),
          );*/
          expect(courrielVuParClient1).to.equal("julien.malard@mail.mcgill.ca");
          // expect(courrielVuParClient2).to.equal("julien.malard@mail.mcgill.ca");
        });

        it("Rechercher", async () => {
          // Eléments détectés
          const { fOublier: fOublier1, fChangerN: fChangerN1 } =
            await client1.recherche.rechercherVariablesSelonNom({
              nomVariable: "Précipitation",
              f: (x) => attendreVars1.mettreÀJour(x),
              nRésultatsDésirés: 1,
            });
          const { fOublier: fOublier2, fChangerN: fChangerN2 } =
            await client2.recherche.rechercherVariablesSelonNom({
              nomVariable: "Précipitation",
              f: (x) => attendreVars2.mettreÀJour(x),
              nRésultatsDésirés: 1,
            });

          const idVariable1 = await client1.variables.créerVariable({
            catégorie: "numérique",
          });
          await client1.variables.sauvegarderNomsVariable({
            idVariable: idVariable1,
            noms: { es: "Precipitación" },
          });

          const idVariable2 = await client1.variables.créerVariable({
            catégorie: "numérique",
          });
          await client1.variables.sauvegarderNomsVariable({
            idVariable: idVariable2,
            noms: { fr: "Précipitation" },
          });

          const val1 = await attendreVars1.attendreQue(
            (x) => x.length > 0 && x[0].id === idVariable2,
          );
          expect(val1.length).to.equal(1);
          expect(val1.map((r) => r.id)).to.have.members([idVariable2]);
          const val2 = await attendreVars2.attendreExiste();
          expect(val2.length).to.equal(1);

          // Augmenter N résultats désirés
          await fChangerN1(2);
          const val3 = await attendreVars1.attendreQue((x) => x.length > 1);
          expect(val3.map((r) => r.id)).to.have.members([
            idVariable1,
            idVariable2,
          ]);
          const val4 = await attendreVars2.attendreExiste();
          expect(val4.length).to.equal(1); // Client 2 n'a pas demandé de changement

          await fChangerN2(2);
          const val5 = await attendreVars2.attendreQue((x) => x.length > 1);
          expect(val5.length).to.equal(2);

          // Diminuer N
          await fChangerN1(1);
          const val6 = await attendreVars1.attendreQue((x) => x.length <= 1);
          expect(val6.map((r) => r.id)).to.have.members([idVariable2]);
          const val7 = await attendreVars2.attendreExiste();
          expect(val7.length).to.equal(2); // Toujours 2 résultats ici

          await fOublier1();
          await fOublier2();
        });

        it("Erreur action", async () => {
          await expect(
            // @ts-expect-error On fait exprès
            client1.jeNeSuisPasUneFonction(),
          ).to.be.rejected();

          await expect(
            // @ts-expect-error On fait exprès
            client2.jeNeSuisPasUnAtribut.ouUneFonction(),
          ).to.be.rejected();
        });

        it("Erreur suivi", async () => {
          await expect(
            // @ts-expect-error On fait exprès
            client1.jeNeSuisPasUneFonction({ f: faisRien }),
          ).to.be.rejected();

          await expect(
            // @ts-expect-error On fait exprès
            client2.jeNeSuisPasUnAtribut.ouUneFonction({ f: faisRien }),
          ).to.be.rejected();
        });
      });
    }),
  );
});
