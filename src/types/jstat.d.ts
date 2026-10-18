declare module 'jstat' {
  const statistics: { jStat: { gammaln(value: number): number; normal: { inv(p: number, mean: number, sd: number): number } } };
  export default statistics;
}
