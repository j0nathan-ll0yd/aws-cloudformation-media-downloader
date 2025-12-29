/**
 * @fixture invalid
 * @rule import-order
 * @severity MEDIUM
 * @description Entities imported before external packages (wrong order)
 * @expectedViolations 1
 */
import {getUser} from '#entities/queries'
import {v4} from 'uuid'
