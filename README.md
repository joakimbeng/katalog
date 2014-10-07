katalog
=========

> A service catalog and discovery application for use with Docker containers

## What?

Katalog listens on Docker events, like container starts and stops.
It looks for environment variables in containers with names `VHOSTNAME` and `SERVICES` and automatically adds them to its service and virtual host catalog.

### `VHOSTNAME`

Format: `<hostname>[:<port>][,<hostname2>[:<port>]...]`.

Example: `VHOSTNAME=my-domain.com,*.my-other-domain.com,nodedev.example.com:3000`


What is this useful for? See `/nginx` endpoint in the API below.


### `SERVICES`

Format: `<service>[:<port>][,<service2>[:<port>]...]`.

Example: `SERVICES=mysql:3306,node-api:3000`


Having the environment variable set as above would fill the service catalog with two services: `mysql` and `node-api` which both will point to their container's IP and their respective ports.

To get information about existing services see `/service` enpoint in the API below.


## Run as a Docker container

**Build**:

```bash
docker build -t katalog .
```

**Run**:

```bash
docker run -d --env "DOCKER_HOST=$DOCKER_HOST" -v `pwd`/data:/app/data -p 5005:5005 katalog
```

## API

### `GET /nginx`

Outputs an Nginx configuration file with reverse proxy configurations for the catalog's virtual hosts, according to each container's `VHOSTNAME` environment variable.

### `GET /vhost`

Returns each virtual host in the catalog, if multiple containers have the same virtual hostname only the containers using the image with highest version number (container tag) will be returned. To get all virtual hosts regardless of version number, use `?all=true` as query string parameter.

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
  "version": "5.5.6"
}
```

Will yield a json object as response with the property `id`, that value is used in the delete endpoint below.

### `DELETE /service/<id>`

Parameter: `id`

Used to manually remove a service from the catalog. Id should be the same as the one in the response when adding the service.
