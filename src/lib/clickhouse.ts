import { createClient } from "@clickhouse/client"

const clickhouseUrl = process.env.CLICKHOUSE_URL || "http://104.129.132.73:8124"
const clickhouseUser = process.env.CLICKHOUSE_USER || "ifn_analytics"
const clickhousePassword = process.env.CLICKHOUSE_PASSWORD || "kpsnylcmnaaarc25qbbfgowykmhynez4"
const clickhouseDatabase = process.env.CLICKHOUSE_DATABASE || "analytics"

export const clickhouse = createClient({
  url: clickhouseUrl,
  username: clickhouseUser,
  password: clickhousePassword,
  database: clickhouseDatabase,
})
