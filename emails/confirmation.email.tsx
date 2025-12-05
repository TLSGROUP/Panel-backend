import * as React from 'react'
import {
	DEFAULT_LANGUAGE,
	type Language
} from '../src/language/language.constants'

const verificationCopy: Record<
	Language,
	{
		title: string
		intro: string
		button: string
		alternate: string
	}
> = {
	en: {
		title: 'Welcome!',
		intro: 'Almost done — please confirm your email address.',
		button: 'Confirm Email',
		alternate: 'or copy the link and paste it into your browser'
	},
	de: {
		title: 'Willkommen!',
		intro: 'Fast geschafft – bitte bestätige deine E-Mail-Adresse.',
		button: 'E-Mail bestätigen',
		alternate: 'oder kopiere den Link und füge ihn in deinen Browser ein'
	}
}

interface VerificationEmailProps {
	url: string
	language?: Language
}

export default function VerificationEmail({
	url,
	language = DEFAULT_LANGUAGE
}: VerificationEmailProps) {
	const texts = verificationCopy[language] ?? verificationCopy[DEFAULT_LANGUAGE]

	return (
		<div>
			<h1>{texts.title}</h1>

			<p>{texts.intro}</p>

			<a href={url}>{texts.button}</a>

			<p>{texts.alternate}</p>

			<a
				href={url}
				target="_blank"
				style={{
					color: '#A981DC'
				}}
			>
				{url}
			</a>
		</div>
	)
}
