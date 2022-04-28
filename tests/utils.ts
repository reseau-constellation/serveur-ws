
export class EncryptionBidon {
  clefs : { publique: string, secrète: string};
  nom = "bidon"

  constructor() {
    this.clefs = { publique: "abc", secrète: "def"};
  }

  encrypter(
    message: string,
  ): string {
    return [...message].reverse().join();
  }

  décrypter(
    message: string,
  ): string {
    return [...message].reverse().join();
  }

  clefAléatoire(): string {
    return Math.random().toString();
  }
}
