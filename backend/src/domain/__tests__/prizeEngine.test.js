'use strict';
const {splitPoolByTier,computeTierPools,splitTierAmongWinners,settleDraw,verifyConservation}=require('../prizeEngine');
describe('Prize engine',()=>{
 test('40/35/25 fixed tier shares',()=>{expect(splitPoolByTier(100000)).toEqual({5:40000,4:35000,3:25000,splitRemainder:0});});
 test('5-match jackpot carry is the only carry',()=>{const s=settleDraw(100000,{5:[],4:[],3:[]},0);expect(s.carryOutJackpot).toBe(40000);expect(s.unawardedMinor).toBe(60000);});
 test('4-match unclaimed never rolls forward',()=>{const s=settleDraw(100000,{5:['u1'],4:[],3:['u3']},0);expect(s.carryOutJackpot).toBe(0);expect(s.unawardedByTier[4]).toBe(35000);});
 test('3-match unclaimed never rolls forward',()=>{const s=settleDraw(100000,{5:['u1'],4:['u4'],3:[]},0);expect(s.unawardedByTier[3]).toBe(25000);});
 test('carry-in only augments tier 5',()=>{expect(computeTierPools(100000,5000)).toEqual({5:45000,4:35000,3:25000,splitRemainder:0});});
 test('remainder is explicit and conservation holds',()=>{const s=settleDraw(101,{5:['u1'],4:[],3:[]},7);expect(s.unawardedMinor).toBe(61);expect(verifyConservation(101,7,s)).toBe(true);});
 test('equal split exposes integer remainder',()=>{expect(splitTierAmongWinners(1000,3)).toEqual({payoutPerWinner:333,remainder:1,totalPaid:999});});
});

