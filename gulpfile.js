////////////////////////////////////
// Gulp all the things
////////////////////////////////////
"use strict";

//
// Requires
// =================================
const gulp = require("gulp");
const sass = require("node-sass");
const tap = require("gulp-tap");
const path = require("path");
const fs = require("fs");
const es = require("event-stream");
const runSequence = require("run-sequence");

//
// Variables
// =================================
const dirs = {
	TS: [
		"src/**/*.ts",
		"!src/**/*.spec.ts",
		"!src/**/*.stories.ts"
	],
	i18n: "src/i18n/**/*.json",
	DIST: "dist"
};

const licenseTemplate = `/*!
 *
 * Carbon-Angular v@PACKAGE_VERSION@ | @FILE_NAME@
 *
 * Copyright 2014, @THIS_YEAR@ IBM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
\n
`;

//
// Build tasks
// =================================
gulp.task("build:angular", _ =>
	gulp.src(dirs.TS)
		.pipe(replaceTemplates())
		.pipe(gulp.dest(`${dirs.DIST}/src`))
);

gulp.task("build:i18n", _ =>
	gulp.src(dirs.i18n)
		.pipe(gulp.dest(`${dirs.DIST}/i18n`))
);

gulp.task("build:license", _ =>
	es.merge(
		gulp.src("LICENSE.md")
			.pipe(gulp.dest(dirs.DIST)),
		gulp.src([
			`${dirs.DIST}/**/*.scss`,
			`${dirs.DIST}/**/*.css`,
			`${dirs.DIST}/**/*.ts`,
			`${dirs.DIST}/**/*.js`
		])
			.pipe(licenseHeaders())
			.pipe(gulp.dest(dirs.DIST))
	)
);

gulp.task("build:package", _ =>
	gulp.src("package.json")
		.pipe(gulp.dest(dirs.DIST))
);

gulp.task("build:readme", _ =>
	gulp.src("README.md")
		.pipe(gulp.dest(dirs.DIST))
);

gulp.task("build:changelog", _ =>
	gulp.src("CHANGELOG.md")
		.pipe(gulp.dest(dirs.DIST))
);

//
// Running tasks
// =================================
gulp.task("build", () => runSequence("build:angular", "build:i18n"));

gulp.task("build:meta", _ =>
	runSequence("build:package", ["build:license", "build:readme", "build:changelog"])
);

//
// Functions
// =================================
function licenseHeaders() {
  return tap(function(file) {
	const packageJSON = require("./package.json");
	const updatedTemplate = licenseTemplate
		.replace("@PACKAGE_VERSION@", packageJSON.version)
		.replace("@FILE_NAME@", path.basename(file.path))
		.replace("@THIS_YEAR@", new Date().getFullYear());
	file.contents = Buffer.concat([new Buffer(updatedTemplate), file.contents]);
  });
}

function replaceTemplates() {
	// regex borrwed from https://github.com/TheLarkInn/angular2-template-loader/blob/1403302e985bf689ee49e9dd8bb953225f32737b/index.js#L5-L7
	const templateUrlRegex = /templateUrl\s*:(\s*['"`](.*?)['"`])/g;
	const stylesRegex = /styleUrls *:(\s*\[[^\]]*?\])/g;

	function templateToString(file, url) {
		url = url.trim().replace(/^\"/g, "").replace(/\"$/g, "");
		let fileStr = path.resolve(file.path, "..", url);
		return fs.readFileSync(fileStr).toString("utf-8");
	}

	function stylesToString(file, urls) {
		urls = JSON.parse(urls);
		let strStyles = "";
		for (let url of urls) {
			const filePath = path.resolve(file.path, "..", url);
			if (fs.existsSync(filePath)) {
				strStyles += sass.renderSync({
					file: filePath
				}).css;
			} else {
				console.warn(`file not found ${filePath} in ${file.path} this may be an error.`);
			}
		}
		return strStyles;
	}

	return tap(function(file) {
		if (path.extname(file.path) === ".ts") {
			let fileStr = file.contents.toString("utf-8");
			if (fileStr.indexOf(templateUrlRegex) < 0 || fileStr.indexOf(stylesRegex) < 0) {
				fileStr = fileStr.replace(templateUrlRegex, (match, url) => `template: \`${templateToString(file, url)}\``)
					.replace(stylesRegex, (match, urls) => `styles: [\`${stylesToString(file, urls)}\`]`);
				file.contents = new Buffer(fileStr);
			}
		}
	});
}
