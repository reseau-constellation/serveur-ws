declare module "find-free-port" {
  export default function (
    portBeg: number,
    portEnd?: number
  ): Promise<number[]>;
}
