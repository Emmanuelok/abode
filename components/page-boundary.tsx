'use client';
import React from 'react';
export class PageBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:Error){console.error('Abode page error',error.message)}
 render(){if(this.state.failed)return <main className="page-container"><div className="recovery-card"><h1>Let’s get you back to browsing.</h1><p>This page couldn’t finish loading. Your saved selections are safe.</p><div className="form-actions"><button className="button" onClick={()=>this.setState({failed:false})}>Try this page again</button><a className="button outline" href="/shop">Open the collection</a></div></div></main>;return this.props.children}
}
