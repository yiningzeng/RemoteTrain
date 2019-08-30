FROM registry.cn-hangzhou.aliyuncs.com/baymin/remote-train:web
COPY dist /usr/local/apache2/htdocs/
RUN mkdir -p /usr/local/apache2/htdocs/test
COPY test /usr/local/apache2/htdocs/test
EXPOSE 80
CMD ["httpd-foreground"]