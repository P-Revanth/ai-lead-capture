/* eslint-disable @next/next/no-img-element */
import { PropertyResult } from '@/types/chat'

const featuredListings: PropertyResult[] = [
    {
        id: 'portfolio-1',
        title: 'Ocean Crest Apartments',
        location: 'madhurawada',
        price: 6800000,
        bhk: '2BHK',
    },
    {
        id: 'portfolio-2',
        title: 'Skyline Residency',
        location: 'rushikonda',
        price: 9400000,
        bhk: '3BHK',
    },
    {
        id: 'portfolio-3',
        title: 'Green Valley Villas',
        location: 'anandapuram',
        price: 15200000,
        bhk: '4BHK',
    },
    {
        id: 'portfolio-4',
        title: 'Harbor View Homes',
        location: 'mvp colony',
        price: 8200000,
        bhk: '3BHK',
    },
    {
        id: 'portfolio-5',
        title: 'Palm Horizon Enclave',
        location: 'seethammadhara',
        price: 7600000,
        bhk: '2BHK',
    },
    {
        id: 'portfolio-6',
        title: 'Lakefront Towers',
        location: 'gajuwaka',
        price: 7100000,
        bhk: '2BHK',
    },
]

const listingImages = ['/property-1.jpg', '/property-2.jpg', '/property-3.jpg'] as const

export default function AgentPortfolioPage() {
    return (
        <main className="min-h-dvh bg-white text-zinc-900 font-sans">
            <section className="bg-white px-4 pt-4 md:px-6 md:pt-6">
                <div className="relative mx-auto flex min-h-[75vh] w-full max-w-350 flex-col overflow-hidden rounded-[2.5rem] bg-zinc-100 md:min-h-200">
                    {/* Background Image */}
                    <div className="absolute inset-0">
                        <img
                            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80"
                            alt="Modern luxury home"
                            className="h-full w-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-black/10 transition-opacity"></div>
                    </div>

                    {/* Floating Navbar */}
                    <header className="relative z-10 flex items-center justify-between p-6 lg:p-8">
                        <div className="flex items-center gap-2 rounded-full bg-white px-5 py-3 shadow-sm">
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500 text-white">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                                </svg>
                            </div>
                            <span className="font-bold tracking-tight text-zinc-900">Nestora</span>
                        </div>

                        <nav className="hidden items-center gap-1 rounded-full bg-white p-2 shadow-sm lg:flex">
                            <a href="#" className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-md">
                                Home
                            </a>
                            <a href="#about" className="rounded-full px-6 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900">
                                About
                            </a>
                            <div className="flex cursor-pointer items-center gap-1 rounded-full px-6 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900">
                                Services <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            <div className="flex cursor-pointer items-center gap-1 rounded-full px-6 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900">
                                Resources <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </nav>

                        <a href="#contact" className="rounded-full bg-white px-7 py-3.5 text-sm font-bold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50">
                            Call Now!
                        </a>
                    </header>

                    {/* Hero Text Cutout */}
                    <div className="relative z-10 mt-auto self-start bg-white w-full md:w-[65%] lg:w-[45%] rounded-tr-[3rem] lg:rounded-tr-[4.5rem] pr-8 pt-10 pb-6 md:pr-12 md:pt-14">
                        <div className="space-y-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Ravi Kumar — Real Estate Consultant</p>
                            <h1 className="text-6xl font-extrabold tracking-tight text-zinc-900 sm:text-7xl lg:text-[5rem] lg:leading-[1.05]">
                                Buy Your Next <br /> Home
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 pt-4">
                                <a
                                    href="#featured-listings"
                                    className="inline-flex items-center gap-4 rounded-full bg-emerald-500 pl-6 pr-2 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:-translate-y-0.5"
                                >
                                    Learn more
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                                        <svg className="h-5 w-5 rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                        </svg>
                                    </span>
                                </a>
                            </div>

                            <p className="max-w-100 text-base font-medium leading-relaxed text-zinc-500">
                                Amazing luxury home waiting for your presence! Come, explore with me. Amazing luxury home waiting for your presence!
                            </p>
                        </div>
                    </div>
                </div>

                {/* Client Focus Below Hero */}
                <div className="mx-auto w-full max-w-350 px-2 py-10 lg:px-4">
                    <aside className="flex flex-col justify-between gap-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 md:flex-row md:items-center">
                        <div className="md:w-1/3">
                            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900">Client Focus</h2>
                            <p className="mt-1 text-sm font-medium text-zinc-500 leading-relaxed max-w-sm">
                                Dedicated expertise in the Vizag residential market helping you find verified properties.
                            </p>
                        </div>
                        <dl className="flex-1 grid max-w-3xl grid-cols-1 gap-6 border-t border-zinc-200 pt-6 sm:grid-cols-3 md:border-l md:border-t-0 md:pl-10 md:pt-0">
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Experience</dt>
                                <dd className="mt-1 text-sm font-bold text-zinc-800">9+ years in Vizag market</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Specialization</dt>
                                <dd className="mt-1 text-sm font-bold text-zinc-800">Apartments, villas &amp; lands</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Coverage</dt>
                                <dd className="mt-1 text-sm font-bold text-zinc-800">Madhurawada, MVP Colony</dd>
                            </div>
                        </dl>
                    </aside>
                </div>
            </section>

            <section id="about" className="bg-white px-4 py-20 lg:px-6">
                <div className="mx-auto w-full max-w-350">
                    <div className="flex flex-col items-center justify-between gap-16 lg:flex-row">
                        <div className="max-w-xl space-y-6 lg:w-1/2">
                            <h2 className="text-[2.5rem] font-extrabold leading-tight tracking-tight text-zinc-900 lg:text-5xl">
                                Learn About Ravi Kumar
                            </h2>
                            <p className="text-sm font-bold text-emerald-500">Real Estate Consultant</p>
                            <p className="text-[15px] leading-relaxed text-zinc-500">
                                Ravi has worked with buyers, families, and investors in Visakhapatnam for nearly a decade.
                                His approach combines local pricing knowledge, project due diligence, and practical guidance so clients
                                can make confident property decisions. Whether you are looking for a luxury sea-facing apartment or a high-return commercial investment, Ravi&apos;s expertise ensures a seamless and transparent transaction.
                            </p>
                            <div className="flex items-center gap-4 pt-2">
                                <a href="#contact" className="rounded-full bg-emerald-500 px-8 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5 hover:bg-emerald-600">
                                    Call Now
                                </a>
                                <a href="#contact" className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5 hover:bg-emerald-600">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </a>
                            </div>
                        </div>

                        <div className="relative flex justify-center lg:w-1/2">
                            <div className="relative h-80 w-80 rounded-full sm:h-100 sm:w-100">
                                <img
                                    src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80"
                                    alt="Ravi Kumar"
                                    className="h-full w-full rounded-full object-cover shadow-2xl"
                                />
                                {/* Decorative Social Orbs */}
                                <div className="absolute left-4 top-1 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl">
                                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10v7M8 7h.01M12 10v7m0-4a2.5 2.5 0 015 0v4M4 5h16v14H4z" />
                                    </svg>
                                </div>
                                <div className="absolute -left-12 bottom-30 flex h-25 w-25 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl">
                                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                                </div>
                                <div className="absolute left-7 -bottom-3 flex h-30 w-30 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl">
                                    <svg className="h-14 w-14" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dark Roadmap Section */}
                    <div className="relative mt-16 overflow-hidden rounded-[2.5rem] bg-[#1a201d] px-8 py-14 md:px-16 lg:py-20 shadow-2xl">
                        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative z-10 lg:w-[45%]">
                                <h3 className="text-3xl font-extrabold text-emerald-500">RoadMap</h3>
                                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                                    End-to-end support tailored to your buying, selling, or investment goals. Shortlist properties that match your budget, location, and timeline. Pricing guidance, listing strategy, and buyer coordination from start to close.
                                </p>
                            </div>

                            <div className="relative flex flex-1 items-center justify-center">
                                {/* Simulated curved connection path */}
                                <div className="absolute h-px w-full bg-zinc-800 lg:top-1/2 lg:-translate-y-1/2"></div>
                                <div className="relative z-10 flex w-full justify-between gap-4">
                                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white shadow-[0_0_0_8px_rgba(16,185,129,0.1)]">01</span>
                                    <span className="flex h-12 w-12 shrink-0 self-end items-center justify-center rounded-full border border-zinc-700 bg-[#1a201d] text-sm font-bold text-zinc-500">02</span>
                                    <span className="flex h-10 w-10 shrink-0 self-start items-center justify-center rounded-full border border-zinc-700 bg-[#1a201d] text-xs font-bold text-zinc-500">03</span>
                                    <span className="flex h-8 w-8 shrink-0 self-end items-center justify-center rounded-full border border-zinc-700 bg-[#1a201d] text-[10px] font-bold text-zinc-500">04</span>
                                </div>
                            </div>

                            <div className="relative z-10 lg:w-[35%] lg:pl-10">
                                <h3 className="text-2xl font-bold text-white">Curated Selection</h3>
                                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                                    Access an exclusive, hand-picked portfolio of premium properties. We match your specific lifestyle requirements and investment goals with the finest real estate opportunities available in the market.
                                </p>
                                <a href="#properties" className="mt-4 inline-block text-xs font-bold text-emerald-500 hover:text-emerald-400">
                                    Learn more...
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="properties" className="bg-[#fcfdfd] px-4 py-24 lg:px-6">
                <div className="mx-auto w-full max-w-350">
                    <div className="mb-14 text-center">
                        <h2 className="text-4xl font-extrabold tracking-tight text-zinc-900">Popular Properties</h2>
                        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-500">
                            A curated set of active properties suitable for first-time buyers and long-term investors. Find the property of your dreams.
                        </p>
                        <div className="mt-8 flex justify-center gap-3">
                            <button className="rounded-full bg-emerald-500 px-8 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-600">
                                Filter
                            </button>
                            <button className="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md transition-colors hover:bg-emerald-600">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        {featuredListings.slice(0, 3).map((property, idx) => {
                            const bhkCount = Number.parseInt((property.bhk ?? '0').charAt(0), 10) || 0

                            return (
                                <div key={property.id} className="group flex flex-col pt-2">
                                    <div className={`relative w-full overflow-hidden rounded-[2.5rem] bg-zinc-200 transition-all ${idx === 1 ? 'h-110 -mt-10' : 'h-90'}`}>
                                        <img
                                            src={listingImages[idx] ?? listingImages[0]}
                                            alt={property.title}
                                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>
                                        <div className="absolute bottom-6 left-6 flex items-center gap-2 text-white">
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <span className="text-sm font-semibold capitalize">{property.location}</span>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex flex-col">
                                        <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(property.price)}
                                        </h3>
                                        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                                            A stunning property offering premium amenities, modern architecture, and unparalleled convenience in the heart of {property.location}.
                                        </p>
                                        <div className="mt-6 flex items-center gap-4 border-t border-zinc-200 pt-4 text-zinc-600">
                                            <div className="flex items-center gap-2">
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                                <span className="text-sm font-semibold">{bhkCount}</span>
                                            </div>
                                            <div className="h-4 w-px bg-zinc-300"></div>
                                            <div className="flex items-center gap-2">
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15h18v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2zM3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4M8 9h8" /></svg>
                                                <span className="text-sm font-semibold">{bhkCount + 1}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section id="featured-listings" className="relative bg-white pt-10 pb-32">
                <div className="absolute top-0 h-[65%] w-full bg-[#1a201d] rounded-b-[4rem]"></div>

                <div className="relative mx-auto w-full max-w-350 px-4 lg:px-6">
                    <div className="flex items-end justify-between pt-16 pb-12">
                        <div className="max-w-xl text-white">
                            <h2 className="text-4xl font-extrabold tracking-tight sm:text-[2.75rem]">Featured Listing</h2>
                            <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
                                Discover our most exclusive property of the month. This exceptional home combines sophisticated design, breathtaking views, and luxury living at its absolute finest.
                            </p>
                        </div>
                        <div className="hidden lg:block">
                            <button className="flex items-center gap-2 text-sm font-bold text-emerald-500 transition-colors hover:text-emerald-400">
                                Next
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
                        {/* Large Active Slider Card */}
                        <div className="relative h-125 w-full overflow-hidden rounded-[2.5rem] lg:w-[45%]">
                            <img
                                src={listingImages[0]}
                                alt="Featured Property"
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"></div>

                            {/* Inner Slider Navigation */}
                            <button className="absolute left-6 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/40">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button className="absolute right-6 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/40">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>

                            <div className="absolute bottom-10 left-10 right-10 text-white">
                                <h3 className="text-2xl font-bold tracking-tight">Harbor View Homes</h3>
                                <p className="mt-2 text-sm font-medium text-white/80 line-clamp-2">
                                    An architectural masterpiece featuring panoramic ocean views, state-of-the-art smart home integration, and resort-style amenities for uncompromising luxury.
                                </p>
                            </div>
                        </div>

                        {/* Smaller Inactive Cards */}
                        <div className="flex w-full flex-1 gap-6 overflow-x-auto pb-4 lg:pb-0">
                            {[featuredListings[1], featuredListings[2]].map((property, idx) => (
                                <div key={property.id} className="min-w-70 flex-1">
                                    <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-zinc-200">
                                        <img
                                            src={listingImages[idx + 1] ?? listingImages[0]}
                                            alt={property.title}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <h4 className="text-lg font-extrabold text-zinc-900">{property.title}</h4>
                                        <p className="mt-2 text-sm leading-relaxed text-zinc-500 line-clamp-3">
                                            Experience elevated living in this beautifully designed {property.bhk} residence. Perfectly situated for both peaceful retreats and urban convenience.
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id="testimonials" className="bg-white px-4 py-20 lg:px-6">
                <div className="mx-auto w-full max-w-350 text-center">
                    <h2 className="text-4xl font-extrabold tracking-tight text-zinc-900">Client Stories</h2>
                    <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-500">
                        Don&apos;t just take our word for it. Hear from families and investors who have successfully found their dream properties and highly profitable investments with our guidance.
                    </p>

                    <div className="relative mx-auto mt-24 flex max-w-4xl flex-col items-center justify-center">
                        {/* Decorative background avatars */}
                        <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 overflow-hidden rounded-full border-4 border-white shadow-xl lg:block h-24 w-24">
                            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80" alt="Client 1" className="h-full w-full object-cover opacity-80" />
                        </div>
                        <div className="absolute left-28 top-0 hidden -translate-y-6 overflow-hidden rounded-full border-4 border-white shadow-xl lg:block h-32 w-32">
                            <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80" alt="Client 2" className="h-full w-full object-cover opacity-90" />
                        </div>

                        <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 overflow-hidden rounded-full border-4 border-white shadow-xl lg:block h-28 w-28">
                            <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80" alt="Client 3" className="h-full w-full object-cover opacity-80" />
                        </div>
                        <div className="absolute right-28 top-4 hidden -translate-y-6 overflow-hidden rounded-full border-4 border-white shadow-xl lg:block h-32 w-32">
                            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" alt="Client 4" className="h-full w-full object-cover opacity-90" />
                        </div>

                        {/* Slider Arrows */}
                        <button className="absolute left-1/4 top-16 hidden -translate-x-12 shrink-0 text-zinc-400 hover:text-zinc-600 lg:block">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <button className="absolute right-1/4 top-16 hidden translate-x-12 shrink-0 text-zinc-400 hover:text-zinc-600 lg:block">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>

                        {/* Center Profile */}
                        <div className="relative mb-6 h-40 w-40 sm:h-48 sm:w-48">
                            <div className="h-full w-full overflow-hidden rounded-full border-[6px] border-white bg-zinc-100 shadow-2xl">
                                <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80" alt="Dipu Paul" className="h-full w-full object-cover" />
                            </div>
                            <div className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-md">
                                <svg className="h-4 w-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                        </div>

                        {/* Rating & Text */}
                        <div className="flex gap-1 text-emerald-500">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <svg key={star} className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            ))}
                        </div>
                        <h3 className="mt-4 text-xl font-extrabold tracking-tight text-zinc-900">Vikram & Anjali Reddy</h3>
                        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
                            &ldquo;Working with Ravi was an absolute pleasure. He understood exactly what we were looking for in our first family home and guided us through every step. His deep knowledge of the local Vizag market and excellent negotiation skills saved us time and money. We couldn&apos;t be happier with our new apartment!&rdquo;
                        </p>
                        <a href="#more" className="mt-4 text-sm font-bold text-emerald-500 hover:text-emerald-400">
                            Learn more
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer with Floating Overlap CTA */}
            <footer id="contact" className="relative mt-24 bg-[#1a201d] pt-32 pb-12">
                <div className="absolute left-1/2 top-0 w-full max-w-275 -translate-x-1/2 -translate-y-1/2 px-4">
                    <div className="flex flex-col items-center justify-between gap-6 rounded-4xl bg-emerald-500 p-8 shadow-2xl md:flex-row md:px-12 md:py-10">
                        <h2 className="text-3xl font-extrabold text-zinc-900 sm:text-4xl">Ready To Get Started</h2>
                        <a href="#contact" className="rounded-full border border-zinc-900 px-8 py-3.5 text-[15px] font-bold text-zinc-900 transition-colors hover:bg-zinc-900 hover:text-white">
                            Contact Now
                        </a>
                    </div>
                </div>

                <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 text-center">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500 text-white">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                        </div>
                        <span className="text-3xl font-extrabold tracking-tight text-emerald-500">Nestora</span>
                    </div>

                    <p className="text-[15px] leading-relaxed text-zinc-400 max-w-lg mb-10">
                        Your trusted partner in premium real estate. We specialize in connecting discerning buyers with exceptional residential and commercial properties across the region. Let&apos;s build your future today.
                    </p>

                    <div className="flex items-center gap-4">
                        <a href="#" className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 transition-colors hover:bg-emerald-500 hover:text-white">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557a9.83 9.83 0 01-2.828.775 4.932 4.932 0 002.165-2.724 9.864 9.864 0 01-3.127 1.195 4.916 4.916 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.557z" /></svg>
                        </a>
                        <a href="#" className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 transition-colors hover:bg-emerald-500 hover:text-white">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                        </a>
                        <a href="#" className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 transition-colors hover:bg-emerald-500 hover:text-white">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </a>
                    </div>
                </div>
            </footer>
        </main>
    )
}