const cleancss = require('gulp-clean-css')
const concat = require('gulp-concat')
const footer = require('gulp-footer')
const gulp = require('gulp')
const header = require('gulp-header')
const gulpif = require('gulp-if')
const iife = require('gulp-iife')
const package = require('./package.json')
const serve = require('gulp-serve')
const uglify = require('gulp-uglify-es').default
const yargs = require('yargs')
const zip = require('gulp-zip')

const argv = yargs(process.argv).parse(),
  isDebug = argv.debug === true

gulp.task('build-css', () => {
  return gulp.src(
    getCss()
  ).pipe(
    concat('styles.min.css')
  ).pipe(
    gulpif(!isDebug, cleancss())
  ).pipe(
    gulp.dest('public')
  )
})

gulp.task('build-js', () => {
  return gulp.src(
    getJs()
  ).pipe(
    concat('scripts.min.js')
  ).pipe(
    footer(
      `;app.version=()=>'${package.version + (isDebug ? '-debug' : '')}';`
    )
  ).pipe(
    gulpif(!isDebug, iife(), header("'use strict';\n\n"))
  ).pipe(
    gulp.dest('public')
  ).pipe(
    gulpif(!isDebug, uglify())
  ).pipe(
    gulp.dest('public')
  )
})

gulp.task('build', gulp.series('build-css', 'build-js'))

gulp.task('dist-html5', () => {
  // XXX: Archive has no root directory
  return gulp.src([
    'public/favicon.png',
    'public/font/*.woff',
    'public/index.html',
    'public/manual.html',
    'public/scripts.min.js',
    'public/styles.min.css',
  ], {base: 'public'}).pipe(
    zip(package.name + '-html5' + '.zip')
  ).pipe(
    gulp.dest('dist')
  )
})

gulp.task('dist', gulp.series('build', 'dist-html5'))

gulp.task('serve', serve({root: 'public', port: process.env.PORT || 8731}))

gulp.task('watch', () => {
  gulp.watch(['src/**'], gulp.series('build'))
})

gulp.task('dev', gulp.parallel('serve', 'watch'))

function getCss() {
  const srcs = [
    'src/css/reset.css',
    'src/css/main.css',
    'src/css/utility/*.css',
    'src/css/component/*.css',
    'src/css/*.css',
    'src/css/**/*.css',
  ]

  return srcs
}

function getJs() {
  return [
    ...getEngineJs(),
    ...getContentJs(),
    ...getAppJs(),
    'src/js/main.js',
  ]
}

function getAppJs() {
  const srcs = [
    'src/js/app.js',
    'src/js/app/screen/base.js',
    'src/js/app/utility/*.js',
    'src/js/app/*.js',
    'src/js/app/**/*.js',
  ]

  return srcs
}

function getContentJs() {
  const srcs = [
    'src/js/content.js',
    'src/js/content/*.js',
    'src/js/content/**/*.js',
  ]

  return srcs
}

function getEngineJs() {
  return [
    'node_modules/syngen/dist/syngen.js',
    'src/js/engine.js',
  ]
}
