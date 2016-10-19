# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="1.6.2"></a>
## [1.6.2](https://github.com/joakimbeng/katalog/compare/v1.6.1...v1.6.2) (2016-10-19)


### Bug Fixes

* **nginx:** debouncing site config save and getting rid of bad delay logic ([340bee5](https://github.com/joakimbeng/katalog/commit/340bee5))



<a name="1.6.1"></a>
## [1.6.1](https://github.com/joakimbeng/katalog/compare/v1.6.0...v1.6.1) (2016-10-19)


### Bug Fixes

* **docker:** don't remove containers on unrelated events ([c31c730](https://github.com/joakimbeng/katalog/commit/c31c730))



<a name="1.6.0"></a>
# [1.6.0](https://github.com/joakimbeng/katalog/compare/v1.5.0...v1.6.0) (2016-10-19)


### Features

* **env:** add ENV_PREFIX variable to customize monitoring behavior ([694e98c](https://github.com/joakimbeng/katalog/commit/694e98c))



<a name="1.5.0"></a>
# [1.5.0](https://github.com/joakimbeng/katalog/compare/1.4.2...v1.5.0) (2016-10-18)


### Bug Fixes

* only get firstNet if Networks hash exists ([35388aa](https://github.com/joakimbeng/katalog/commit/35388aa))


### Features

* **docker:** use dumb-init to support SIGTERM and other signals ([7c32c1a](https://github.com/joakimbeng/katalog/commit/7c32c1a))
* **logs:** show timestamp in logs ([4a5b5d3](https://github.com/joakimbeng/katalog/commit/4a5b5d3))
* **storage:** use NeDB for a more reliable storage solution ([9fabe65](https://github.com/joakimbeng/katalog/commit/9fabe65))
