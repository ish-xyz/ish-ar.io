import addToMailchimp from "gatsby-plugin-mailchimp"
import TextField from "@material-ui/core/TextField"
import Button from "@material-ui/core/Button"
import { Typography } from "@material-ui/core"
import React from "react"

export default class MailChimpForm extends React.Component {
  constructor() {
    super()
    this.state = { email: "", result: null }
  }
  _handleSubmit = async e => {
    e.preventDefault()
    const payload = await addToMailchimp(this.state.email)
    this.setState({result: payload.result})
    this.setState({msg: payload.msg})
  }
  handleChange = event => {
    this.setState({ email: event.target.value })
  }
  render() {
    return this.state.result === "success" ? (
      <div id="form-success">{this.state.msg}</div>
    ) : this.state.result === "error" ? (
      <div id="form-error">ERROR</div>
    ) : (
      <div id="form-mc">
      <form onSubmit={this._handleSubmit}>
        <TextField
          id="outlined-email-input"
          label="Email Address"
          type="email"
          name="email"
          autoComplete="email"
          variant="outlined"
          onChange={this.handleChange}
        />
        <Button
          variant="contained"
          color="primary"
          label="Submit"
          type="submit"
        >
          <Typography variant="button">Subscribe</Typography>
        </Button>
      </form>
      </div>
    )
  }
}