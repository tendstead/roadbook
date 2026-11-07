FROM node:24-alpine AS web
WORKDIR /src/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.27.3 AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ cmd/
COPY internal/ internal/
COPY --from=web /src/web/build/ cmd/server/static/
RUN CGO_ENABLED=0 go build -trimpath -o /roadbook ./cmd/server

FROM alpine:3.23
RUN apk add --no-cache ca-certificates tzdata && addgroup -g 10001 roadbook && adduser -D -u 10001 -G roadbook roadbook && mkdir /data && chown roadbook:roadbook /data
COPY --from=server /roadbook /app/roadbook
USER 10001:10001
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=4s --start-period=15s CMD ["/app/roadbook", "-healthcheck"]
ENTRYPOINT ["/app/roadbook"]
