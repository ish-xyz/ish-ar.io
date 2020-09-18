import React from "react"
import { Link } from "gatsby"
import { rhythm, scale } from "../utils/typography"
import MailChimpForm from "../components/mailchimp"
import "./layout.css"

class Layout extends React.Component {
  render() {
    const { location, title, children } = this.props
    const rootPath = `${__PATH_PREFIX__}/`
    let header

    if (location.pathname === rootPath) {
      header = (
        <span>
          <h1
            style={{
              ...scale(1.5),
              marginBottom: rhythm(0),
              marginTop: 0,
            }}
          >

            <Link
              style={{
                boxShadow: `none`,
                textDecoration: `none`,
                color: `inherit`,
              }}
              title={title}
              to={`/`}
            >
              {title}
            </Link>
          </h1>
          <h2
            style={{
              marginTop: rhythm(0.5),
              marginBottom: rhythm(2),
            }}
          > 
              Observability, Linux Internals, Devops and more... 
          </h2>
        </span>
      )
    } else {
      header = (
        <span>
            <h4
            style={{
              fontFamily: `Montserrat, sans-serif`,
              marginTop: 0,
              marginBottom: rhythm(0.2),
            }}
          >
            <Link
              style={{
                boxShadow: `none`,
                textDecoration: `none`,
                color: `inherit`,
              }}
              to={`/`}
            >
              {title}
            </Link>
          </h4>
          <MailChimpForm></MailChimpForm>
        </span>
      )
    }
    return (
      <div
        style={{
          marginLeft: `auto`,
          marginRight: `auto`,
          maxWidth: rhythm(28),
          padding: `${rhythm(1.5)} ${rhythm(3 / 4)}`,
        }}
      >
        <header>{header}</header>
        <main>{children}</main>
        <footer>
          © {new Date().getFullYear()}, Isham Araia's Blog.
          Contact me: <a target="_blank" title="Isham Araia's Twitter Profile" href="https://www.linkedin.com/in/isham-araia-086a986b/">LinkedIn</a> * <a target="_blank" title="Isham Araia's Twitter Profile" href="https://twitter.com/isham_araia">Twitter</a>
        </footer>
      </div>
    )
  }
}

export default Layout
