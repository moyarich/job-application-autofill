import { it, expect } from "vitest";
import type { Page } from "playwright";
import { helpWorkdaySignIn } from "../../packages/job-sites/workday/workday-login.ts";
const env={RESUME_SITE_EMAIL:"test@example.com",RESUME_SITE_PASSWORD:"test-only"};

it("signs in once with configured credentials without creating an account", async () => {
  const {vi}=await import("vitest");
  let signedIn=false;
  const email={isVisible:async()=>true,fill:vi.fn()};
  const password={isVisible:async()=>true,fill:vi.fn(),waitFor:async()=>{}};
  const hidden={isVisible:async()=>false,waitFor:async()=>{}};
  const submit={isVisible:async()=>true,click:vi.fn(async()=>{signedIn=true;})};
  const page={
    url:()=>"https://workday.wd5.myworkdayjobs.com/apply",
    getByRole:(role: string,{name}:{name?: string | RegExp})=>({first:()=>hidden,last:()=>role==="button"&&name instanceof RegExp&&name.test("Sign In")?submit:hidden}),
    getByLabel:(pattern: RegExp)=>({first:()=>pattern.test("Email Address")?email:password,last:()=>pattern.test("Email Address")?email:password}),
    locator:()=>({innerText:async()=>"Sign In. Welcome! Create an account to manage applications."})
  };
  const session={page: page as unknown as Page};
  await helpWorkdaySignIn(session,env);
  expect(signedIn).toBe(true);
  expect(email.fill).toHaveBeenCalledWith(env.RESUME_SITE_EMAIL);
  expect(password.fill).toHaveBeenCalledWith(env.RESUME_SITE_PASSWORD);
  await helpWorkdaySignIn(session,env);
  expect(submit.click).toHaveBeenCalledTimes(1);
});


