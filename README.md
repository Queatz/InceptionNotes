# InceptionTodo

Configure
=========

Modify `environments/*.ts` to match your setup.

Build
=====

`./b`

Files are in `dist/`.  Copy them to `/root/ui` on your ui server, or use a different location and modify the below.

Deploy
=====

```shell
apt update
apt install certbot nodejs npm nginx python3-certbot-nginx
```

## HTTP -> HTTPS

1. Configure Nginx
2. Replace the contents of `/etc/nginx/sites-enabled/default` with the following

```
server {
    server_name <enter server host here>;
    root /root/ui;
    listen 80;

    location / {
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

`chmod 755 -R /root`

3. Finally

```shell
certbot --nginx
nginx -t
service nginx restart
```
