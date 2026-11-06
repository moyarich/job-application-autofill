import { describe, it, expect } from "vitest";
import { findPdfPython } from "../packages/resume/src/extract-resume/python-runtime.ts";

describe("PDF Python environment resolution", () => {
  it("uses an explicitly configured and verified interpreter", async () => {
    const calls: string[][] = [];
    const run = async (command: string,args: string[]) => { calls.push([command,...args]); return {stdout:""}; };
    expect(await findPdfPython({env:{PYTHON_EXECUTABLE:"/opt/venv/bin/python"},executeCommand:run})).toBe("/opt/venv/bin/python");
    expect(calls).toHaveLength(1);
  });
  it("does not silently use system Python when explicitly selected interpreter is broken", async () => {
    const run = async () => { throw new Error("No module named pypdfium2"); };
    await expect(findPdfPython({env:{PYTHON_EXECUTABLE:"/bad/python"},executeCommand:run})).rejects.toThrow(/Configured PYTHON_EXECUTABLE/);
  });
  it("prefers an existing Poetry virtualenv over system python", async () => {
    const run = async (command: string,args: string[]) => {
      if(command==="poetry" && args[0]==="env")return {stdout:"/home/user/.cache/pypoetry/virtualenvs/moya/bin/python\n"};
      if(command.includes("virtualenvs"))return {stdout:""};
      throw new Error("system unavailable");
    };
    expect(await findPdfPython({env:{},executeCommand:run})).toContain("virtualenvs");
  });
  it("installs dependencies once via Poetry when no interpreter is ready", async () => {
    let installed=false,installs=0;
    const run = async (command: string,args: string[]) => {
      if(command==="poetry"&&args[0]==="env")return {stdout:"/venv/python\n"};
      if(command==="poetry"&&args[0]==="install"){installed=true;installs++;return {stdout:""};}
      if(command==="/venv/python"&&installed)return {stdout:""};
      throw new Error("Missing pypdfium2");
    };
    expect(await findPdfPython({env:{},executeCommand:run})).toBe("/venv/python");
    expect(installs).toBe(1);
  });
  it("reports a setup error when Poetry itself cannot be installed", async () => {
    const run = async () => {throw Object.assign(new Error("poetry not found"),{stderr:"poetry not found"});};
    await expect(findPdfPython({env:{},executeCommand:run})).rejects.toThrow(/install Poetry/i);
  });
  it("can fail fast without installing dependencies when autoInstall is disabled", async () => {
    const run = async()=>{throw new Error("missing");};
    await expect(findPdfPython({env:{},executeCommand:run,autoInstall:false})).rejects.toThrow(/npm run dev/);
  });
});
