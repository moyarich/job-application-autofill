import {describe,it,expect} from "vitest";
import {workdayCredentials,helpWorkdaySignIn} from "../packages/job-sites/workday/workday-login.ts";
const env={RESUME_SITE_EMAIL:"test@example.com",RESUME_SITE_PASSWORD:"test-only"};
describe("Workday environment credentials",()=>{
  it("allows only the configured HTTPS employer tenant",()=>{
    expect(workdayCredentials("https://workday.wd5.myworkdayjobs.com/apply",env)).toEqual({email:env.RESUME_SITE_EMAIL,password:env.RESUME_SITE_PASSWORD});
    for(const url of ["https://other.wd5.myworkdayjobs.com/apply","http://workday.wd5.myworkdayjobs.com","https://workday.wd5.myworkdayjobs.com.evil.example","https://accounts.google.com","https://user:pass@workday.wd5.myworkdayjobs.com"])
      expect(workdayCredentials(url,env)).toBeNull();
  });
  it("does not touch a page without credentials or repeat an attempt",async()=>{
    const page={url:()=>"https://workday.wd5.myworkdayjobs.com/apply"};
    await expect(helpWorkdaySignIn({page},{})).resolves.toBeUndefined();
    await expect(helpWorkdaySignIn({page,loginAttempted:true},env)).resolves.toBeUndefined();
  });
});

it("signs in once with configured credentials without creating an account", async () => {
  const {vi}=await import("vitest");
  let signedIn=false;
  const email={isVisible:async()=>true,fill:vi.fn()};
  const password={isVisible:async()=>true,fill:vi.fn(),waitFor:async()=>{}};
  const hidden={isVisible:async()=>false,waitFor:async()=>{}};
  const submit={isVisible:async()=>true,click:vi.fn(async()=>{signedIn=true;})};
  const page={
    url:()=>"https://workday.wd5.myworkdayjobs.com/apply",
    getByRole:(role,{name})=>({first:()=>hidden,last:()=>role==="button"&&name instanceof RegExp&&name.test("Sign In")?submit:hidden}),
    getByLabel:pattern=>({first:()=>pattern.test("Email Address")?email:password}),
    locator:()=>({innerText:async()=>"Sign In. Welcome! Create an account to manage applications."})
  };
  const session={page};
  await helpWorkdaySignIn(session,env);
  expect(signedIn).toBe(true);
  expect(email.fill).toHaveBeenCalledWith(env.RESUME_SITE_EMAIL);
  expect(password.fill).toHaveBeenCalledWith(env.RESUME_SITE_PASSWORD);
  await helpWorkdaySignIn(session,env);
  expect(submit.click).toHaveBeenCalledTimes(1);
});

it("prefills only email on account creation and never sets a new password",async()=>{
  const {vi}=await import("vitest");
  const email={isVisible:async()=>true,fill:vi.fn()};
  const password={isVisible:async()=>true,waitFor:async()=>{},fill:vi.fn()};
  const hidden={isVisible:async()=>false,waitFor:async()=>{},click:vi.fn()};
  const heading={isVisible:async()=>true};
  const page={url:()=>"https://workday.wd5.myworkdayjobs.com/create-account",
    getByRole:role=>({first:()=>role==="heading"?heading:hidden,last:()=>hidden}),
    getByLabel:pattern=>({first:()=>pattern.test("Email Address")?email:password}),
    locator:()=>({innerText:async()=>"Create Account. Confirm password."})};
  await helpWorkdaySignIn({page},env);
  expect(email.fill).toHaveBeenCalledWith(env.RESUME_SITE_EMAIL);
  expect(password.fill).not.toHaveBeenCalled();
  expect(hidden.click).not.toHaveBeenCalled();
});
