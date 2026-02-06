const RAW_BACKEND_URL = process.env.BACKEND_PUBLIC_URL || 'http://localhost:4200'
export const API_URL = RAW_BACKEND_URL.replace(/\/$/, '')
export const VERIFY_EMAIL_URL = `${API_URL}/verify-email?token=`

const DEFAULT_CLIENT_APP_URL = process.env.CLIENT_APP_URL || 'http://localhost:3000'
export const CLIENT_APP_URL = DEFAULT_CLIENT_APP_URL.replace(/\/$/, '')
export const REFERRAL_REGISTER_PATH = '/register'
export const buildReferralLink = (code: string) =>
	`${CLIENT_APP_URL}${REFERRAL_REGISTER_PATH}?ref=${code}`
