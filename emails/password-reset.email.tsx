import * as React from 'react'
import {
	DEFAULT_LANGUAGE,
	type Language
} from '../src/language/language.constants'

const passwordResetCopy: Record<
	Language,
	{
		title: string
		intro: string
		instructions: string
		expiration: string
		footer: string
	}
> = {
	en: {
		title: 'Password reset',
		intro: 'We received a request to reset your password.',
		instructions: 'Use this verification code to continue:',
		expiration: 'The code is valid for 15 minutes.',
		footer:
			"If you didn't request a password change, simply ignore this email and nothing will happen."
	},
	de: {
		title: 'Passwort zurücksetzen',
		intro: 'Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten.',
		instructions: 'Verwende diesen Bestätigungscode, um fortzufahren:',
		expiration: 'Der Code ist 15 Minuten lang gültig.',
		footer:
			'Wenn du keine Passwortänderung angefordert hast, ignoriere diese E-Mail einfach – es passiert nichts.'
	}
}

interface PasswordResetEmailProps {
	code: string
	language?: Language
}

export default function PasswordResetEmail({
	code,
	language = DEFAULT_LANGUAGE
}: PasswordResetEmailProps) {
	const texts = passwordResetCopy[language] ?? passwordResetCopy[DEFAULT_LANGUAGE]

	return (
		<div
			style={{
				fontFamily: 'Arial, sans-serif',
				lineHeight: 1.5,
				color: '#111'
			}}
		>
			<h2>{texts.title}</h2>
			<p>{texts.intro}</p>
			<p>
				{texts.instructions}
				<br />
				<span
					style={{
						display: 'inline-block',
						marginTop: '8px',
						padding: '12px 18px',
						background: '#f4f4f5',
						borderRadius: '8px',
						fontSize: '20px',
						letterSpacing: '4px',
						fontWeight: 600
					}}
				>
					{code}
				</span>
			</p>
			<p>{texts.expiration}</p>
			<p>{texts.footer}</p>
		</div>
	)
}
