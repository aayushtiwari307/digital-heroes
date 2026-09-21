'use strict';
const {buildTicket,createSeededRng,drawRandomNumbers,drawWeightedNumbers,countMatches,matchTier}=require('../drawEngine');
describe('Draw engine',()=>{
 test('builds a deduped ticket from exactly five scores',()=>{expect(buildTicket([10,10,20,30,40])).toEqual([10,20,30,40]);});
 test('seed gives reproducible random result',()=>{const a=drawRandomNumbers(createSeededRng('0123456789abcdef'));const b=drawRandomNumbers(createSeededRng('0123456789abcdef'));expect(a).toEqual(b);expect(new Set(a).size).toBe(5);expect(a.every(n=>n>=1&&n<=45)).toBe(true);});
 test('seed gives reproducible algorithmic result',()=>{const tickets=[[1,2,3,4,5],[1,2,3,4,5],[6,7,8,9,10]];expect(drawWeightedNumbers(tickets,createSeededRng('cafebabe'))).toEqual(drawWeightedNumbers(tickets,createSeededRng('cafebabe')));});
 test('matching is set intersection',()=>{expect(countMatches([1,1,2,3,4],[1,2,3,40,41])).toBe(3);expect(matchTier([1,2,3,4,11],[1,2,3,4,41])).toBe(4);});
 test('authoritative functions require a seeded rng',()=>{expect(()=>drawRandomNumbers()).toThrow(/seeded RNG/);expect(()=>drawWeightedNumbers([[1,2,3,4,5]])).toThrow(/seeded RNG/);});
});
