#!/usr/bin/env node

import { interactiveRequest } from "./lib/cli.js";

const result = await interactiveRequest("screenshot");
if (result) console.log(result.path);
