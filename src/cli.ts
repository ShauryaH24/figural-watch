#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { validateCommand } from "./commands/validate.js";
import { reportCommand } from "./commands/report.js";

const program = new Command();

program
  .name("figural-watch")
  .description("Validate and watch SpecPack drift in git diffs.")
  .version("0.0.0");

program.addCommand(initCommand());
program.addCommand(validateCommand());
program.addCommand(reportCommand());

program.parse(process.argv);

