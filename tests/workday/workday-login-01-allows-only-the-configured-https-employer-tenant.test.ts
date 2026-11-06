import {describe,it,expect} from "vitest";
import type { Page } from "playwright";
import {workdayCredentials,helpWorkdaySignIn} from "../../packages/job-sites/workday/workday-login.ts";
const env={RESUME_SITE_EMAIL:"test@example.com",RESUME_SITE_PASSWORD:"test-only"};
describe("Workday environment credentials",()=>{
  it("allows only the configured HTTPS employer tenant",()=>{
    expect(workdayCredentials("https://workday.wd5.myworkdayjobs.com/apply",env)).toEqual({email:env.RESUME_SITE_EMAIL,password:env.RESUME_SITE_PASSWORD});
    for(const url of ["https://other.wd5.myworkdayjobs.com/apply","http://workday.wd5.myworkdayjobs.com","https://workday.wd5.myworkdayjobs.com.evil.example","https://accounts.google.com","https://user:pass@workday.wd5.myworkdayjobs.com"])
      expect(workdayCredentials(url,env)).toBeNull();
  });
  
});


