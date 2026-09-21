'use strict';
const {rateLimit}=require('../rateLimit');

describe('rateLimit',()=>{
  const original=process.env.NODE_ENV;
  const originalFlag=process.env.TEST_RATE_LIMITS;
  afterEach(()=>{process.env.NODE_ENV=original; if(originalFlag===undefined)delete process.env.TEST_RATE_LIMITS; else process.env.TEST_RATE_LIMITS=originalFlag;});

  test('limits a client after the configured threshold',()=>{
    process.env.NODE_ENV='test';
    process.env.TEST_RATE_LIMITS='1';
    const middleware=rateLimit({windowMs:60_000,max:1,name:'unit-limit'});
    let passed=0; const responses=[];
    const makeRes=()=>({set:()=>{},status(code){responses.push(code);return this;},json:()=>this});
    const req={ip:'unit-test-ip'};
    middleware(req,makeRes(),()=>{passed+=1;});
    middleware(req,makeRes(),()=>{passed+=1;});
    expect(passed).toBe(1);
    expect(responses).toEqual([429]);
  });
});
