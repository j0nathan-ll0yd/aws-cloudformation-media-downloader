import {createQueryFactory} from '@mantleframework/database'
import {getDrizzleClient} from '#db/client'

export const {defineQuery, definePreparedQuery} = createQueryFactory(getDrizzleClient)
