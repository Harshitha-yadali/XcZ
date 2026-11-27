# The Auto Apply runner: Node plus a real Chromium, nothing else.
# Build from the repository root, since it runs the shared engine in
# supabase/functions/_shared:
#
#   docker build -f worker/Dockerfile -t primoboost-apply-worker .
#   docker run -d --name apply-worker --restart=always --env-file worker/.env --shm-size=1g primoboost-apply-worker
FROM node:22-bookworm-slim

# Fonts so forms and resumes render as they do for a person.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker/index.mjs worker/
COPY supabase/functions/_shared supabase/functions/_shared

ENV CHROME=/usr/bin/chromium NODE_ENV=production
# The worker starts Chromium with --no-sandbox; it still need not run as root.
USER node
CMD ["node", "--experimental-strip-types", "worker/index.mjs"]
