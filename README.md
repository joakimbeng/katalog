katalog
=========

> A service catalog and discovery application for use with Docker containers

<!-- MDTOC maxdepth:6 firsth1:2 numbering:0 flatten:0 bullets:1 updateOnSave:1 -->

- [What?](#what)   
- [Usage](#usage)   
   - [`ENV_PREFIX`](#env_prefix)   
- [Container env vars](#container-env-vars)   
   - [`KATALOG_VHOSTS`](#katalog_vhosts)   
   - [`KATALOG_SERVICES`](#katalog_services)   
- [API](#api)   
   - [`GET /nginx`](#get-nginx)   
   - [`GET /value`](#get-value)   
   - [`GET /value/<key>`](#get-valuekey)   
   - [`POST /value/<key>`](#post-valuekey)   
   - [`DELETE /value/<key>`](#delete-valuekey)   
   - [`GET /vhost`](#get-vhost)   
   - [`POST /vhost`](#post-vhost)   
   - [`DELETE /vhost/<id>`](#delete-vhostid)   
   - [`GET /service`](#get-service)   
   - [`GET /service/<name>`](#get-servicename)   
   - [`POST /service`](#post-service)   
   - [`DELETE /service/<id>`](#delete-serviceid)   

<!-- /MDTOC -->

## What?

Katalog listens on Docker events, like container starts and stops.
It looks for environment variables in containers with names `KATALOG_VHOSTS` and `KATALOG_SERVICES` (the env var names can be customized using [`ENV_PREFIX`](#env_prefix)) and automatically adds them to its service and virtual host catalog. It also generates an nginx reversed proxy config for all virtual hosts.

## Usage

**Build**:

```bash
docker pull joakimbeng/katalog
```

**Run**:

```bash
docker run -d --privileged -v /var/run/docker.sock:/var/run/docker.sock -v `pwd`/data:/app/data -v `pwd`/nginx:/app/nginx -p 5005:5005 joakimbeng/katalog
```

**TIP:** Use this in conjunction with `joakimbeng/nginx-site-watcher` and mount the `/app/nginx` volume above to `/etc/nginx/sites-enabled` in the nginx container.

### `ENV_PREFIX`

Default: `KATALOG_`  

To use other env variables than `KATALOG_VHOSTS` and `KATALOG_SERVICES` one can set the env var `ENV_PREFIX`.  
E.g. running Katalog with `ENV_PREFIX=LOCAL_` will make Katalog monitor `LOCAL_VHOSTS` and `LOCAL_SERVICES` env vars instead of the default.

This is useful if you wan't to have more than one Katalog instance running which feed different Nginx configs.

## Container env vars

When Katalog is running it will monitor all Docker events and listen for container starts and stops. It will then look for some special env vars set in each container (see below) which is used to register services and virtual hosts automatically.

### `KATALOG_VHOSTS`

Format: `<hostname>[/<path>][:<port>][,<hostname2>[/<path>][:<port>]...]`.

Example: `KATALOG_VHOSTS=my-domain.com,other.com/folder,*.my-other-domain.com,nodedev.example.com:3000,192.168.1.10:80`


What is this useful for? See `/nginx` endpoint in the API below. The hostname `"default"` is a special one, and if specified for a container that container will be used as the default server fallback when no other virtual host is matching.

To customize the name of this variable see [`ENV_PREFIX`](#env_prefix).


### `KATALOG_SERVICES`

Format: `<service>[:<port>][,<service2>[:<port>]...]`.

Example: `KATALOG_SERVICES=mysql:3306,node-api:3000`


Having the environment variable set as above would fill the service catalog with two services: `mysql` and `node-api` which both will point to their container's IP and their respective ports.

To get information about existing services see `/service` enpoint in the API below.

To customize the name of this variable see [`ENV_PREFIX`](#env_prefix).


## API

**Note** each endpoint takes an optional query parameter `?pretty` and if provided the JSON response is idented and more readable.

### `GET /nginx`

Outputs an Nginx configuration file with reverse proxy configurations for the catalog's virtual hosts, according to each container's `KATALOG_VHOSTS` environment variable.

### `GET /value`

Get all values from the key/value store.


### `GET /value/<key>`

Parameter: `key`


Get a value from the key/value store.


### `POST /value/<key>`

Parameter: `key`


Set a value in the key/value store.


### `DELETE /value/<key>`

Parameter: `key`


Delete a value from the key/value store.


### `GET /vhost`

Returns each virtual host in the catalog, if multiple containers have the same virtual hostname only the containers using the image with highest version number (container tag) will be returned. To get all virtual hosts regardless of version number, use `?all=true` as query string parameter.

### `POST /vhost`

Used to manually add a virtual host to the catalog.

Example data:

```json
{
  "name": "dev.example.com",
  "port": "8080",
  "version": "1.0.0",
  "ip": "<ip address>",
  "id": "<identifier>"
}
```

* `ip`: Optional, uses remote address if not specified
* `id`: Optional, generates a value from ip, name, version and port if not specified


Will yield a json object as response with the property `id`, that value is used in the delete endpoint below.

### `DELETE /vhost/<id>`

Parameter: `id`

Used to manually remove a virtual host from the catalog. Id should be the same as the one in the response when adding the virtual host.

### `GET /service`

Returns each service in the catalog and their endpoints, if multiple containers have the same service only the containers using the image with highest version number (container tag) will be returned. To get all services regardless of version number, use `?all=true` as query string parameter.

### `GET /service/<name>`

Parameters: `name`

Returns all endpoints for a given service name, if multiple containers have the same service only the containers using the image with highest version number (container tag) will be returned. To get all services regardless of version number, use `?all=true` as query string parameter.

### `POST /service`

Used to manually add a service to the catalog.

Example data:

```json
{
  "name": "mysql",
  "port": "3306",
  "version": "5.5.6",
  "ip": "<ip address>",
  "id": "<identifier>"
}
```

* `ip`: Optional, uses remote address if not specified
* `id`: Optional, generates a value from ip, name, version and port if not specified


Will yield a json object as response with the property `id`, that value is used in the delete endpoint below.

### `DELETE /service/<id>`

Parameter: `id`

Used to manually remove a service from the catalog. Id should be the same as the one in the response when adding the service.
