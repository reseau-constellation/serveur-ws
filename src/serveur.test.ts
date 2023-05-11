import { execa } from "execa";
import { rimraf } from "rimraf";
import { mkdtempSync, existsSync } from "fs";
import { tmpdir } from "os";
import { sep, join } from "path";

import { utilsTests, version as versionIPA, utils } from "@constl/ipa";
import { MandataireClientConstellation } from "@constl/mandataire";

import lancerServeur from "@/serveur.js";
import générerClient from "@/client.js";
import { version } from "@/version.js";
import { MessageBinaire } from "./const";

// Quand ça plante avec throw new Error('Listener is not ready yet');
// ps -ef | grep "node" | grep -v grep
// kill <idp>

const faisRien = () => {
  return;
};

const limTempsPremierTest = (typeServeur: string) => {
  return typeServeur === "Serveur ligne de commande" ? 5 * 60 * 1000 : 10000;
};

const limTempsTest = (typeServeur: string) => {
  return typeServeur === "Serveur ligne de commande" ? 10 * 1000 : 5000;
};

const analyserMessage = (message: string): MessageBinaire | undefined => {
  if (!message.startsWith("MESSAGE MACHINE :")) return;
  return JSON.parse(message.split("MESSAGE MACHINE :")[1]);
} 

const typesServeurs: () => {
  [clef: string]: ({
    dossier,
  }: {
    dossier?: string;
  }) => Promise<{ fermerServeur: () => Promise<void>; port: number }>;
} = () => {
  const typesFinaux: {
    [clef: string]: ({
      dossier,
    }: {
      dossier?: string;
    }) => Promise<{ fermerServeur: () => Promise<void>; port: number }>;
  } = {};
  if (process.env.TYPE_SERVEUR === "proc" || !process.env.TYPE_SERVEUR) {
    typesFinaux["Serveur même fil"] = async ({
      dossier,
    }: {
      dossier?: string;
    }) => {
      const dirTemp = dossier ? dossier : mkdtempSync(`${tmpdir()}${sep}`);

      const dossierSFIP = join(dirTemp, "sfip");
      const sfip = await utilsTests.sfip.initierSFIP(dossierSFIP);

      const { fermerServeur, port } = await lancerServeur({
        optsConstellation: {
          orbite: {
            dossier: join(dirTemp, "orbite"),
            sfip: { sfip },
          },
        },
      });
      return {
        port,
        fermerServeur: async () => {
          await fermerServeur();
          await utilsTests.sfip.arrêterSFIP(sfip);
          rimraf.sync(dirTemp);
        },
      };
    };
  }

  if (process.env.TYPE_SERVEUR === "bin" || !process.env.TYPE_SERVEUR) {
    typesFinaux["Serveur ligne de commande"] = ({
      dossier,
    }: {
      dossier?: string;
    }) => {
      const dirTemp = dossier ? dossier : mkdtempSync(`${tmpdir()}${sep}`);

      const dossierSFIP = join(dirTemp, "sfip");
      const dossierOrbite = join(dirTemp, "orbite");
      const { stdout, stdin, stderr } = execa("./dist/bin.js", [
        "lancer",
        "-m",
        `--doss-sfip=${dossierSFIP}`,
        `--doss-orbite=${dossierOrbite}`,
      ]);
      stderr?.on("data", (d)=>{
        console.warn(d.toString())
      })

      const fermerServeur = () => {
        const promesseFermer = new Promise<void>((résoudre) => {
          stdout?.on("data", (données) => {
            const message = analyserMessage(données.toString())

            if (message && message.type === "NŒUD FERMÉ") {
              rimraf.sync(dirTemp);
              résoudre();
            }
          });
        });
        stdin?.write("\n");
        return promesseFermer;
      }

      return new Promise((résoudre) => {
        stdout?.on("data", (d) => {
          const données = d.toString()

          const lignes = données.split("\n")

          for (const l of lignes) {
            const message =  analyserMessage(l);

            if (message && message.type === "NŒUD PRÊT") {
              résoudre({
                port: message.port,
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
    test("Obtenir version serveur", async () => {
      const { stdout } = await execa("./dist/bin.js", ["version"]);
      expect(stdout).toEqual(version);
    });
    test("Obtenir version IPA", async () => {
      const { stdout } = await execa("./dist/bin.js", ["v-constl"]);
      expect(stdout).toEqual(versionIPA);
    });
  });
}

describe("Configuration serveur", function () {
  Object.entries(typesServeurs()).forEach(([typeServeur, fGénérerServeur]) =>
    describe(typeServeur, () => {
      let fermerServeur: () => Promise<void>;
      let dossier: string;
      const fsOublier: (() => void)[] = [];

      beforeAll(async () => {
        dossier = mkdtempSync(`${tmpdir()}${sep}`);
        ({ fermerServeur } = await fGénérerServeur({
          dossier,
        }));
      }, limTempsTest(typeServeur));

      afterAll(async () => {
        if (fermerServeur) await fermerServeur();
        await Promise.all(fsOublier.map((f) => f()));
      }, limTempsTest(typeServeur));

      test("Dossier SFIP", async () => {
        const attendreSFIPExiste = new utilsTests.attente.AttendreFichierExiste(
          join(dossier, "sfip")
        );
        fsOublier.push(() => attendreSFIPExiste.annuler());

        await attendreSFIPExiste.attendre();
        expect(existsSync(join(dossier, "sfip"))).toBe(true);
      });
      test("Dossier Orbite", async () => {
        const attendreOrbiteExiste =
          new utilsTests.attente.AttendreFichierExiste(join(dossier, "orbite"));
        fsOublier.push(() => attendreOrbiteExiste.annuler());
        await attendreOrbiteExiste.attendre();
        expect(existsSync(join(dossier, "orbite"))).toBe(true);
      }, limTempsTest(typeServeur));
    })
  );
});

describe("Fonctionalités serveurs", function () {
  Object.entries(typesServeurs()).forEach(([typeServeur, fGénérerServeur]) =>
    describe(typeServeur, () => {
      let fermerServeur: () => Promise<void>;
      let port: number;

      beforeAll(async () => {
        ({ fermerServeur, port } = await fGénérerServeur({}));
      }, limTempsTest(typeServeur));

      afterAll(async () => {
        if (fermerServeur) await fermerServeur();
      }, limTempsTest(typeServeur));

      describe("Fonctionalités base serveur", () => {
        let fermerClient: () => void;
        let monClient: MandataireClientConstellation;
        const attendreNoms = new utilsTests.attente.AttendreRésultat<{
          [clef: string]: string;
        }>();
        const attendreMC = new utilsTests.attente.AttendreRésultat<
          utils.résultatRecherche<utils.infoRésultatTexte>[]
        >();

        beforeAll(async () => {
          ({ client: monClient, fermerClient } = await générerClient({ port }));
        }, limTempsTest(typeServeur));

        afterAll(async () => {
          if (fermerClient) fermerClient();
          attendreNoms.toutAnnuler();
          attendreMC.toutAnnuler();
        });

        test(
          "Action",
          async () => {
            const idOrbite = await monClient.obtIdOrbite();

            expect(typeof idOrbite).toEqual("string");
            expect(idOrbite.length).toBeGreaterThan(0);
          },
          limTempsPremierTest(typeServeur)
        ); // Beaucoup plus long pour le premier test (le serveur doit se réveiller)

        test(
          "Suivre",
          async () => {
            const oublierNoms = await monClient.profil!.suivreNoms({
              f: (n) => attendreNoms.mettreÀJour(n),
            });

            const val = await attendreNoms.attendreExiste();
            expect(Object.keys(val)).toHaveLength(0);

            await monClient.profil!.sauvegarderNom({
              langue: "fr",
              nom: "Julien Jean Malard-Adam",
            });
            const val2 = await attendreNoms.attendreQue(
              (x) => Object.keys(x).length > 0
            );
            expect(val2).toEqual({ fr: "Julien Jean Malard-Adam" });

            await oublierNoms();

            await monClient.profil!.sauvegarderNom({
              langue: "es",
              nom: "Julien Jean Malard-Adam",
            });
            expect(attendreNoms.val).toEqual({ fr: "Julien Jean Malard-Adam" });
          },
          limTempsTest(typeServeur)
        );

        test("Rechercher", async () => {
          // Eléments détectés
          const { fOublier, fChangerN } =
            await monClient.recherche!.rechercherMotClefSelonNom({
              nomMotClef: "Météo Montréal",
              f: (x) => attendreMC.mettreÀJour(x),
              nRésultatsDésirés: 1,
            });

          const idMotClef1 = await monClient.motsClefs!.créerMotClef();
          await monClient.motsClefs!.ajouterNomsMotClef({
            id: idMotClef1,
            noms: { fr: "Météo à Montréal" },
          });

          const idMotClef2 = await monClient.motsClefs!.créerMotClef();
          await monClient.motsClefs!.ajouterNomsMotClef({
            id: idMotClef2,
            noms: { fr: "Météo Montréal" },
          });

          const val = await attendreMC.attendreQue(
            (x) => x.length > 0 && x[0].id === idMotClef2
          );
          expect(val.map((r) => r.id)).toEqual(
            expect.arrayContaining([idMotClef2])
          );

          // Augmenter N résultats désirés
          await fChangerN(2);
          const val2 = await attendreMC.attendreQue((x) => x.length > 1);
          expect(val2.map((r) => r.id)).toEqual(
            expect.arrayContaining([idMotClef1, idMotClef2])
          );

          // Diminuer N
          await fChangerN(1);
          const val3 = await attendreMC.attendreQue((x) => x.length <= 1);
          expect(val3.map((r) => r.id)).toEqual(
            expect.arrayContaining([idMotClef2])
          );

          await fOublier();
        });

        test(
          "Erreur fonction suivi inexistante",
          async () => {
            await expect(() =>
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              monClient.jeNeSuisPasUneFonction({ f: faisRien })
            ).rejects.toThrow();
          },
          limTempsTest(typeServeur)
        );
        test(
          "Erreur action inexistante",
          async () => {
            await expect(() =>
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              monClient.jeNeSuisPasUnAtribut.ouUneFonction()
            ).rejects.toThrow();
          },
          limTempsTest(typeServeur)
        );
      });

      describe("Multiples clients", function () {
        let client1: MandataireClientConstellation;
        let client2: MandataireClientConstellation;

        let fermerClient1: () => void;
        let fermerClient2: () => void;
        const fsOublier: (() => void)[] = [];

        const attendreVars1 = new utilsTests.attente.AttendreRésultat<
          utils.résultatRecherche<utils.infoRésultatTexte>[]
        >();
        const attendreVars2 = new utilsTests.attente.AttendreRésultat<
          utils.résultatRecherche<utils.infoRésultatTexte>[]
        >();

        beforeAll(async () => {
          ({ client: client1, fermerClient: fermerClient1 } =
            await générerClient({ port }));
          ({ client: client2, fermerClient: fermerClient2 } =
            await générerClient({ port }));
        }, limTempsTest(typeServeur));

        afterAll(async () => {
          if (fermerClient1) fermerClient1();
          if (fermerClient2) fermerClient2();
          await Promise.all(fsOublier.map((f) => f()));
          attendreVars1.toutAnnuler();
          attendreVars2.toutAnnuler();
        });

        test(
          "Action",
          async () => {
            const [idOrbite1, idOrbite2] = await Promise.all([
              client1.obtIdOrbite(),
              client2.obtIdOrbite(),
            ]);
            expect(typeof idOrbite1).toEqual("string");
            expect(idOrbite1.length).toBeGreaterThan(0);

            expect(idOrbite1).toEqual(idOrbite2);
          },
          limTempsTest(typeServeur)
        );
        test(
          "Suivre",
          async () => {
            let courriel1: string | null = null;
            let courriel2: string | null = null;

            fsOublier.push(
              await client1.profil!.suivreCourriel({
                f: (courriel) => (courriel1 = courriel),
              })
            );
            fsOublier.push(
              await client2.profil!.suivreCourriel({
                f: (courriel) => (courriel2 = courriel),
              })
            );

            await client1.profil!.sauvegarderCourriel({
              courriel: "julien.malard@mail.mcgill.ca",
            });
            await new Promise((résoudre) => setTimeout(résoudre, 2000));

            expect(courriel1).toEqual("julien.malard@mail.mcgill.ca");
            expect(courriel2).toEqual("julien.malard@mail.mcgill.ca");
          },
          limTempsTest(typeServeur)
        );

        test("Rechercher", async () => {
          // Eléments détectés
          const { fOublier: fOublier1, fChangerN: fChangerN1 } =
            await client1.recherche!.rechercherVariableSelonNom({
              nomVariable: "Précipitation",
              f: (x) => attendreVars1.mettreÀJour(x),
              nRésultatsDésirés: 1,
            });
          const { fOublier: fOublier2, fChangerN: fChangerN2 } =
            await client2.recherche!.rechercherVariableSelonNom({
              nomVariable: "Précipitation",
              f: (x) => attendreVars2.mettreÀJour(x),
              nRésultatsDésirés: 1,
            });

          const idVariable1 = await client1.variables!.créerVariable({
            catégorie: "numérique",
          });
          await client1.variables!.ajouterNomsVariable({
            id: idVariable1,
            noms: { es: "Precipitación" },
          });

          const idVariable2 = await client1.variables!.créerVariable({
            catégorie: "numérique",
          });
          await client1.variables!.ajouterNomsVariable({
            id: idVariable2,
            noms: { fr: "Précipitation" },
          });

          const val1 = await attendreVars1.attendreQue(
            (x) => x.length > 0 && x[0].id === idVariable2
          );
          expect(val1.length).toEqual(1);
          expect(val1.map((r) => r.id)).toEqual(
            expect.arrayContaining([idVariable2])
          );
          const val2 = await attendreVars2.attendreExiste()
          expect(val2.length).toEqual(1);

          // Augmenter N résultats désirés
          await fChangerN1(2);
          const val3 = await attendreVars1.attendreQue((x) => x.length > 1);
          expect(val3.map((r) => r.id)).toEqual(
            expect.arrayContaining([idVariable1, idVariable2])
          );
          const val4 = await attendreVars2.attendreExiste()
          expect(val4.length).toEqual(1); // Client 2 n'a pas demandé de changement

          await fChangerN2(2);
          const val5 = await attendreVars2.attendreQue((x) => x.length > 1);
          expect(val5.length).toEqual(2);

          // Diminuer N
          await fChangerN1(1);
          const val6 = await attendreVars1.attendreQue((x) => x.length <= 1);
          expect(val6.map((r) => r.id)).toEqual(
            expect.arrayContaining([idVariable2])
          );
          const val7 = await attendreVars2.attendreExiste()
          expect(val7.length).toEqual(2); // Toujours 2 résultats ici

          await fOublier1();
          await fOublier2();
        });

        test(
          "Erreur action",
          async () => {
            await expect(() =>
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              client1.jeNeSuisPasUneFonction()
            ).rejects.toThrow();

            await expect(() =>
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              client2.jeNeSuisPasUnAtribut.ouUneFonction()
            ).rejects.toThrow();
          },
          limTempsTest(typeServeur)
        );

        test(
          "Erreur suivi",
          async () => {
            await expect(() =>
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              client1.jeNeSuisPasUneFonction({ f: faisRien })
            ).rejects.toThrow();

            await expect(() =>
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              client2.jeNeSuisPasUnAtribut.ouUneFonction({ f: faisRien })
            ).rejects.toThrow();
          },
          limTempsTest(typeServeur)
        );
      });
    })
  );
});
