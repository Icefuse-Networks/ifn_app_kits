import { createClient } from "@clickhouse/client"

const clickhouseUrl = process.env.CLICKHOUSE_URL
const clickhouseUser = process.env.CLICKHOUSE_USER
const clickhousePassword = process.env.CLICKHOUSE_PASSWORD
const clickhouseDatabase = process.env.CLICKHOUSE_DATABASE

if (!clickhouseUrl || !clickhouseUser || !clickhousePassword || !clickhouseDatabase) {
  throw new Error("Missing required ClickHouse environment variables: CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD, CLICKHOUSE_DATABASE")
}

export const clickhouse = createClient({
  url: clickhouseUrl,
  username: clickhouseUser,
  password: clickhousePassword,
  database: clickhouseDatabase,
})
