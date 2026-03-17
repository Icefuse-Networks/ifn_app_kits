import { createClient } from "@clickhouse/client"

export const clickhouse = createClient({
  url: "http://104.129.132.73:8124",
  username: "ifn_analytics",
  password: "kpsnylcmnaaarc25qbbfgowykmhynez4",
  database: "analytics",
})
