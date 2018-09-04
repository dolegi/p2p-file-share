default:
	go run main.go

build:
	rm -rf dist
	mkdir dist
	GOOS=linux go build main.go
	mv main dist/

compress:
	docker run -v $$PWD/dist:/data znly/upx --brute /data/main

deploy:
	cp Dockerfile dist/
	cd dist && now --public --name files

prod: build compress deploy

