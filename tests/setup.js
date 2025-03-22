import { config } from '@vue/test-utils'
import * as Vue from 'vue'

// Make Vue available globally
global.Vue = Vue

// Suppress async validator warnings
config.global.config = {
  warnHandler: () => null
} 